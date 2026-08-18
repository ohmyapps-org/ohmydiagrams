import {
  type UmlEdge,
  type UmlEdgeKind,
  type UmlNode,
  type UmlNodeKind,
  edgeKindOf,
  nodeKindOf,
} from '../types/uml'

export interface GraphIndex {
  nodeById: Map<string, UmlNode>
  /** Edges grouped by their UML kind. */
  byKind: Map<UmlEdgeKind, UmlEdge[]>
  /** Every edge touching a node, regardless of direction or kind. */
  incident: Map<string, UmlEdge[]>
  nodesOfKind: (kind: UmlNodeKind) => UmlNode[]
}

export function buildIndex(
  nodes: readonly UmlNode[],
  edges: readonly UmlEdge[],
): GraphIndex {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const byKind = new Map<UmlEdgeKind, UmlEdge[]>()
  const incident = new Map<string, UmlEdge[]>()

  for (const node of nodes) incident.set(node.id, [])

  for (const edge of edges) {
    const kind = edgeKindOf(edge)
    const bucket = byKind.get(kind)
    if (bucket) bucket.push(edge)
    else byKind.set(kind, [edge])

    // Skip dangling edges: a node may have been deleted from an imported file.
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue
    incident.get(edge.source)?.push(edge)
    if (edge.target !== edge.source) incident.get(edge.target)?.push(edge)
  }

  const byNodeKind = new Map<UmlNodeKind, UmlNode[]>()
  for (const node of nodes) {
    const kind = nodeKindOf(node)
    const bucket = byNodeKind.get(kind)
    if (bucket) bucket.push(node)
    else byNodeKind.set(kind, [node])
  }

  return {
    nodeById,
    byKind,
    incident,
    nodesOfKind: (kind) => byNodeKind.get(kind) ?? [],
  }
}

export function edgesOfKind(index: GraphIndex, kind: UmlEdgeKind): UmlEdge[] {
  return index.byKind.get(kind) ?? []
}

/**
 * Edges that take part in a directed cycle, found via Tarjan's strongly
 * connected components: any edge whose endpoints share a non-trivial SCC lies
 * on a cycle. Self-loops are reported too.
 */
export function edgesInCycles(edges: readonly UmlEdge[]): Set<string> {
  const inCycle = new Set<string>()
  const adjacency = new Map<string, string[]>()
  const seen = new Set<string>()

  for (const edge of edges) {
    if (edge.source === edge.target) {
      inCycle.add(edge.id)
      continue
    }
    seen.add(edge.source)
    seen.add(edge.target)
    const list = adjacency.get(edge.source)
    if (list) list.push(edge.target)
    else adjacency.set(edge.source, [edge.target])
  }

  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const component = new Map<string, number>()
  let counter = 0
  let componentId = 0

  // Iterative Tarjan: diagrams are small, but recursion depth is never a risk.
  for (const root of seen) {
    if (index.has(root)) continue
    const work: { node: string; child: number }[] = [{ node: root, child: 0 }]
    index.set(root, counter)
    low.set(root, counter)
    counter += 1
    stack.push(root)
    onStack.add(root)

    while (work.length > 0) {
      const frame = work[work.length - 1]!
      const neighbours = adjacency.get(frame.node) ?? []

      if (frame.child < neighbours.length) {
        const next = neighbours[frame.child]!
        frame.child += 1
        if (!index.has(next)) {
          index.set(next, counter)
          low.set(next, counter)
          counter += 1
          stack.push(next)
          onStack.add(next)
          work.push({ node: next, child: 0 })
        } else if (onStack.has(next)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, index.get(next)!))
        }
        continue
      }

      work.pop()
      const parent = work[work.length - 1]
      if (parent) {
        low.set(parent.node, Math.min(low.get(parent.node)!, low.get(frame.node)!))
      }

      if (low.get(frame.node) === index.get(frame.node)) {
        const members: string[] = []
        let popped: string | undefined
        do {
          popped = stack.pop()
          if (popped === undefined) break
          onStack.delete(popped)
          members.push(popped)
        } while (popped !== frame.node)

        if (members.length > 1) {
          for (const member of members) component.set(member, componentId)
        }
        componentId += 1
      }
    }
  }

  for (const edge of edges) {
    const a = component.get(edge.source)
    const b = component.get(edge.target)
    if (a !== undefined && a === b) inCycle.add(edge.id)
  }

  return inCycle
}

/**
 * Use cases that can justify their existence: reachable from some actor through
 * associations, optionally hopping up generalization chains, since a child use
 * case inherits its parent's actor participation.
 */
export function reachableUseCasesFromActors(index: GraphIndex): Set<string> {
  const associations = edgesOfKind(index, 'association')
  const generalizations = edgesOfKind(index, 'generalization')

  // Use cases directly associated with an actor.
  const grounded = new Set<string>()
  for (const edge of associations) {
    const source = index.nodeById.get(edge.source)
    const target = index.nodeById.get(edge.target)
    if (!source || !target) continue
    if (nodeKindOf(source) === 'actor' && nodeKindOf(target) === 'useCase') {
      grounded.add(target.id)
    }
    if (nodeKindOf(target) === 'actor' && nodeKindOf(source) === 'useCase') {
      grounded.add(source.id)
    }
  }

  // Inheritance: child -> parent edges mean the child is covered when the
  // parent is. Propagate until nothing new appears.
  let changed = true
  while (changed) {
    changed = false
    for (const edge of generalizations) {
      if (grounded.has(edge.target) && !grounded.has(edge.source)) {
        const child = index.nodeById.get(edge.source)
        if (child && nodeKindOf(child) === 'useCase') {
          grounded.add(edge.source)
          changed = true
        }
      }
    }
  }

  return grounded
}

/** Number of association edges connecting `nodeId` to an actor or use case. */
export function associationDegree(index: GraphIndex, nodeId: string): number {
  return (index.incident.get(nodeId) ?? []).filter(
    (edge) => edgeKindOf(edge) === 'association',
  ).length
}

/** True when the node participates in at least one association, directly or by inheritance. */
export function hasPurpose(index: GraphIndex, nodeId: string): boolean {
  if (associationDegree(index, nodeId) > 0) return true
  const visited = new Set<string>([nodeId])
  const queue = [nodeId]
  const generalizations = edgesOfKind(index, 'generalization')

  while (queue.length > 0) {
    const current = queue.pop()!
    for (const edge of generalizations) {
      const next =
        edge.source === current
          ? edge.target
          : edge.target === current
            ? edge.source
            : null
      if (next === null || visited.has(next)) continue
      visited.add(next)
      if (associationDegree(index, next) > 0) return true
      queue.push(next)
    }
  }
  return false
}
