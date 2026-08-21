import { useDocument } from '../store/document'
import type { UmlEdge, UmlNode } from '../types/uml'
import { nodeRect, rectCenter, type Point } from '../uml/geometry'
import type { BridgeMethod, BridgeParams, BridgeResult } from './protocol'


/**
 * Where on the canvas a tool call happened, so the agent's face can go and
 * stand there while it works. Nothing here changes the document: a missing
 * answer just means "no particular place", and the presence layer keeps the
 * face wherever it already was.
 */

function centreOf(nodes: readonly UmlNode[]): Point | null {
  if (nodes.length === 0) return null
  let x = 0
  let y = 0
  for (const node of nodes) {
    const centre = rectCenter(nodeRect(node))
    x += centre.x
    y += centre.y
  }
  return { x: x / nodes.length, y: y / nodes.length }
}

function nodesById(ids: readonly unknown[]): UmlNode[] {
  const wanted = new Set(ids.filter((id): id is string => typeof id === 'string'))
  return useDocument.getState().nodes.filter((node) => wanted.has(node.id))
}

function edgeCentre(edge: UmlEdge | undefined): Point | null {
  if (!edge) return null
  return centreOf(nodesById([edge.source, edge.target]))
}

/**
 * Deletions have to be measured before they happen — afterwards there is
 * nothing left to point at. Every other method reads better once it landed.
 */
export function focusBefore(method: BridgeMethod, params: unknown): Point | null {
  if (method !== 'deleteElements') return null
  const ids = (params as BridgeParams<'deleteElements'>)?.ids
  return Array.isArray(ids) ? centreOf(nodesById(ids)) : null
}

export function focusAfter(
  method: BridgeMethod,
  result: unknown,
  before: Point | null,
): Point | null {
  const state = useDocument.getState()

  switch (method) {
    case 'addNode':
    case 'updateNode':
      return centreOf(nodesById([(result as BridgeResult<'addNode'>)?.id]))

    case 'addEdge': {
      const id = (result as BridgeResult<'addEdge'>)?.id
      return edgeCentre(state.edges.find((edge) => edge.id === id))
    }

    case 'insertSkeleton':
      return centreOf(nodesById((result as BridgeResult<'insertSkeleton'>)?.ids ?? []))

    // Reading the whole diagram, or replacing it: the face steps back and
    // takes in everything at once.
    case 'getDiagram':
    case 'getValidation':
    case 'loadDocument':
      return centreOf(state.nodes)

    // Deletions carry the point measured before the call; the rest — a title
    // change, an emptied canvas — happen nowhere in particular.
    default:
      return before
  }
}
