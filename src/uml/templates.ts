import { createEdge, createNode } from '../store/document'
import { NODE_SPECS, type UmlEdge, type UmlNode } from '../types/uml'
import type { Point } from './geometry'

/** A ready-made group of elements inserted as one undoable step. */
export interface Fragment {
  nodes: UmlNode[]
  edges: UmlEdge[]
}

/** Clear of the boundary's title band. */
const FIRST_ROW_OFFSET = 70
const ROW_SPACING = 100
/** Horizontal air between the actor and the left wall of the boundary. */
const ACTOR_GAP = 60

const USE_CASE_LABELS = [
  'Registrar venta',
  'Consultar stock',
  'Emitir comprobante',
] as const

/**
 * The canonical use case diagram: one actor outside the system boundary, three
 * named use cases inside it, and an association from the actor to each one.
 * Every piece is placed so the skeleton starts out passing the containment,
 * naming and connectivity rules instead of opening with a wall of red.
 */
export function createUseCaseSkeleton(center: Point): Fragment {
  const boundarySpec = NODE_SPECS.boundary
  const useCaseSpec = NODE_SPECS.useCase
  const actorSpec = NODE_SPECS.actor

  const left = center.x - boundarySpec.width / 2
  const top = center.y - boundarySpec.height / 2

  const boundary = createNode('boundary', { x: left, y: top }, 'Sistema')

  const useCases = USE_CASE_LABELS.map((label, row) =>
    createNode(
      'useCase',
      {
        x: left + (boundarySpec.width - useCaseSpec.width) / 2,
        y: top + FIRST_ROW_OFFSET + row * ROW_SPACING,
      },
      label,
    ),
  )

  const actor = createNode(
    'actor',
    {
      x: left - ACTOR_GAP - actorSpec.width,
      y: center.y - actorSpec.height / 2,
    },
    'Cliente',
  )

  return {
    nodes: [boundary, actor, ...useCases],
    edges: useCases.map((useCase) =>
      createEdge('association', actor.id, useCase.id),
    ),
  }
}
