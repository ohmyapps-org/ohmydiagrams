import type { DiagramKind } from '../types/document'
import {
  EDGE_SPECS,
  NODE_SPECS,
  type UmlDocument,
  type UmlEdge,
  type UmlEdgeKind,
  type UmlNode,
  type UmlNodeKind,
} from '../types/uml'
import { snap } from '../uml/geometry'
import { actorKey, type PlanillaActor, type PlanillaModel } from './model'

/** Air between two use case columns inside the boundary. */
const COLUMN_GAP = 56
/** Air between two use cases stacked in the same column. */
const ROW_GAP = 34
/** Clearance kept inside the boundary walls. */
const INSET = 28
/** Room reserved at the top of the boundary for its own title. */
const TITLE_BAND = 70
/** Air between an actor and the wall of the boundary it faces. */
const ACTOR_GAP = 72
/** Minimum air between two actors stacked on the same side. */
const ACTOR_STACK_GAP = 28

/**
 * Turns a parsed specification into a laid-out use case diagram.
 *
 * The layout is deterministic — same document in, byte-identical file out — so
 * regenerating after an edit to the Markdown produces a reviewable diff rather
 * than a reshuffled canvas. Positions are chosen so the result opens passing
 * the checklist: use cases inside the boundary (rule 5), actors outside it
 * (rule 6), and every element in at least one relationship (rule 17).
 */
export function layoutPlanilla(model: PlanillaModel, kind: DiagramKind = 'useCase'): UmlDocument {
  const actors = orderActors(model.actors)
  const columns = buildColumns(model, actors)

  const rows = Math.max(1, ...columns.map((column) => column.codes.length))
  const width = columns.length * NODE_SPECS.useCase.width
    + Math.max(0, columns.length - 1) * COLUMN_GAP
    + INSET * 2
  const height = TITLE_BAND
    + rows * NODE_SPECS.useCase.height
    + Math.max(0, rows - 1) * ROW_GAP
    + INSET

  const boundary = node('boundary', 'boundary', model.system, { x: 0, y: 0 }, {
    width: snap(width),
    height: snap(height),
  })

  const nodes: UmlNode[] = [boundary]
  const edges: UmlEdge[] = []
  const useCaseIds = new Map<string, string>()

  columns.forEach((column, index) => {
    const x = INSET + index * (NODE_SPECS.useCase.width + COLUMN_GAP)
    column.codes.forEach((code, row) => {
      const y = TITLE_BAND + row * (NODE_SPECS.useCase.height + ROW_GAP)
      const useCase = model.useCases.find((candidate) => candidate.code === code)
      const id = `uc_${slug(code)}`
      useCaseIds.set(code, id)
      nodes.push(node('useCase', id, useCase?.name ?? code, { x, y }))
    })
  })

  /* Actors sit outside the boundary, level with the column they drive. The
     generalization chain goes on the left as one vertical run; actors that
     stand outside the hierarchy go on the right, so the chain reads cleanly
     and their association lines stay short. */
  const actorIds = new Map<string, string>()
  const sides = splitSides(actors)

  for (const [side, group] of Object.entries(sides) as [Side, PlanillaActor[]][]) {
    const x = side === 'left'
      ? -NODE_SPECS.actor.width - ACTOR_GAP
      : Number(boundary.width) + ACTOR_GAP

    const ys = stackActors(group, columns, Number(boundary.height))
    group.forEach((actor, index) => {
      const id = `actor_${slug(actorKey(actor.name))}`
      actorIds.set(actorKey(actor.name), id)
      nodes.push(node('actor', id, actor.name, { x, y: ys[index] as number }))
    })
  }

  /* Associations: from the owning actor only. Inherited access is what the
     generalization edges express; drawing it again would be the same fact
     stated twice, and rule 8 is satisfied either way. */
  for (const useCase of model.useCases) {
    if (!useCase.actor) continue
    const source = actorIds.get(actorKey(useCase.actor))
    const target = useCaseIds.get(useCase.code)
    if (source && target) {
      edges.push(edge('association', `assoc_${slug(useCase.code)}`, source, target))
    }
  }

  for (const actor of actors) {
    if (!actor.generalizes) continue
    const child = actorIds.get(actorKey(actor.name))
    const parent = actorIds.get(actorKey(actor.generalizes))
    // Generalization runs child -> parent.
    if (child && parent) {
      edges.push(edge('generalization', `gen_${slug(actorKey(actor.name))}`, child, parent))
    }
  }

  for (const relation of model.relations) {
    const source = useCaseIds.get(relation.from)
    const target = useCaseIds.get(relation.to)
    if (!source || !target) continue
    edges.push(
      edge(
        relation.kind,
        `${relation.kind}_${slug(relation.from)}_${slug(relation.to)}`,
        source,
        target,
      ),
    )
  }

  return {
    version: 1,
    kind,
    meta: { title: model.title, description: model.description ?? describe(model) },
    nodes,
    edges,
  }
}

/* -------------------------------------------------------------------------- */
/* Columns and sides                                                          */
/* -------------------------------------------------------------------------- */

interface Column {
  /** Actor key that drives this column, or `null` for the factored cases. */
  actor: string | null
  codes: string[]
}

type Side = 'left' | 'right'

/**
 * One column per actor, in hierarchy order, with the factored cases in a column
 * of their own between the two sides. A use case whose actor never appears in
 * the actor list still gets drawn, in the factored column, rather than dropped.
 */
function buildColumns(model: PlanillaModel, actors: readonly PlanillaActor[]): Column[] {
  const sides = splitSides(actors)
  const columnFor = (actor: PlanillaActor): Column => ({
    actor: actorKey(actor.name),
    codes: model.useCases
      .filter((useCase) => useCase.actor && actorKey(useCase.actor) === actorKey(actor.name))
      .map((useCase) => useCase.code),
  })

  const known = new Set(actors.map((actor) => actorKey(actor.name)))
  const factored = model.useCases
    .filter((useCase) => !useCase.actor || !known.has(actorKey(useCase.actor)))
    .map((useCase) => useCase.code)

  const columns = [
    ...sides.left.map(columnFor),
    ...(factored.length > 0 ? [{ actor: null, codes: factored }] : []),
    ...sides.right.map(columnFor),
  ]
  return columns.filter((column) => column.codes.length > 0)
}

/**
 * Actors that take part in a generalization, as parent or as child, go on the
 * left; the rest go on the right. With no hierarchy at all everything stays on
 * the left, which is the conventional reading order for a small diagram.
 */
function splitSides(actors: readonly PlanillaActor[]): Record<Side, PlanillaActor[]> {
  const parents = new Set(
    actors.flatMap((actor) => (actor.generalizes ? [actorKey(actor.generalizes)] : [])),
  )
  const inHierarchy = (actor: PlanillaActor): boolean =>
    actor.generalizes !== null || parents.has(actorKey(actor.name))

  const hierarchical = actors.filter(inHierarchy)
  if (hierarchical.length === 0) return { left: [...actors], right: [] }

  const standalone = actors.filter((actor) => !inHierarchy(actor))
  return { left: hierarchical, right: standalone }
}

/** Roots first, then each actor directly under the one it specialises. */
function orderActors(actors: readonly PlanillaActor[]): PlanillaActor[] {
  const remaining = [...actors]
  const ordered: PlanillaActor[] = []
  const placed = new Set<string>()

  // Bounded by the input: every pass places at least one actor, and a cycle in
  // the hierarchy falls through to the flush below instead of spinning.
  let progress = true
  while (remaining.length > 0 && progress) {
    progress = false
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const actor = remaining[index] as PlanillaActor
      const parent = actor.generalizes ? actorKey(actor.generalizes) : null
      if (parent !== null && !placed.has(parent) && actors.some((a) => actorKey(a.name) === parent)) {
        continue
      }
      ordered.push(actor)
      placed.add(actorKey(actor.name))
      remaining.splice(index, 1)
      progress = true
    }
  }
  return [...ordered, ...remaining]
}

/**
 * Vertical position of each actor on one side, top to bottom in hierarchy
 * order. Each one wants to sit level with the middle of its own column, but
 * columns hold different numbers of use cases, so those preferred positions
 * collide and can even invert the hierarchy. Order wins: an actor is pushed
 * down until it clears the one above it, which keeps the generalization chain
 * reading downward and keeps two actors from landing on top of each other.
 */
function stackActors(
  group: readonly PlanillaActor[],
  columns: readonly Column[],
  boundaryHeight: number,
): number[] {
  const ys: number[] = []
  group.forEach((actor, index) => {
    const column = columns.find((candidate) => candidate.actor === actorKey(actor.name))
    const preferred = column && column.codes.length > 0
      ? columnCenter(column.codes.length) - NODE_SPECS.actor.height / 2
      : evenlySpaced(index, group.length, boundaryHeight)
    const previous = ys[index - 1]
    ys.push(
      previous === undefined
        ? preferred
        : Math.max(preferred, previous + NODE_SPECS.actor.height + ACTOR_STACK_GAP),
    )
  })
  return ys
}

function columnCenter(rows: number): number {
  const span = rows * NODE_SPECS.useCase.height + Math.max(0, rows - 1) * ROW_GAP
  return TITLE_BAND + span / 2
}

function evenlySpaced(index: number, count: number, height: number): number {
  const band = height / Math.max(1, count)
  return band * index + (band - NODE_SPECS.actor.height) / 2
}

/* -------------------------------------------------------------------------- */
/* Node and edge factories                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Local factories rather than the store's: these ids are derived from the
 * document codes, so the same Markdown always produces the same file, whereas
 * `nextId` seeds from the clock.
 */
function node(
  kind: UmlNodeKind,
  id: string,
  label: string,
  position: { x: number; y: number },
  size?: { width: number; height: number },
): UmlNode {
  const spec = NODE_SPECS[kind]
  return {
    id,
    type: kind,
    position: { x: snap(position.x), y: snap(position.y) },
    width: size?.width ?? spec.width,
    height: size?.height ?? spec.height,
    data: {
      label,
      fill: null,
      stroke: null,
      fontSize: kind === 'boundary' ? 15 : 14,
      lineStyle: 'solid',
      z: spec.z,
      attributes: [],
      operations: [],
    },
    zIndex: spec.z,
    selected: false,
  }
}

function edge(kind: UmlEdgeKind, id: string, source: string, target: string): UmlEdge {
  return {
    id,
    type: 'uml',
    source,
    target,
    data: { kind, label: EDGE_SPECS[kind].defaultLabel, fontSize: 12, waypoints: [] },
    selected: false,
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function describe(model: PlanillaModel): string {
  return `${model.useCases.length} casos de uso y ${model.actors.length} actores, generados desde la especificación en Markdown.`
}
