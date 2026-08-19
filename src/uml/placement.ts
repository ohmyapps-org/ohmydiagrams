import { NODE_SPECS, nodeKindOf, type UmlNode, type UmlNodeKind } from '../types/uml'
import { GRID_SIZE, nodeRect, snap, type Point } from './geometry'

const GAP = 40
/** How far a repeated drop steps away from the one before it, in grid units. */
const CASCADE = GRID_SIZE * 2
/** Air kept between a use case and the walls of the boundary. */
const INSET = 24

function sizeOf(node: UmlNode): { width: number; height: number } {
  const spec = NODE_SPECS[nodeKindOf(node)]
  return { width: node.width ?? spec.width, height: node.height ?? spec.height }
}

/** Free spot to the right of everything already drawn. */
export function rightOfEverything(nodes: readonly UmlNode[]): Point {
  if (nodes.length === 0) return { x: 0, y: 0 }
  const right = Math.max(...nodes.map((node) => node.position.x + sizeOf(node).width))
  const top = Math.min(...nodes.map((node) => node.position.y))
  return { x: right + GAP, y: top }
}

/**
 * Where the next use case should go: inside the system boundary, under the
 * ones already there, so a use case created from the checklist or from a
 * requirements document does not land outside and fail rule 5 on arrival.
 */
export function nextUseCaseSlot(nodes: readonly UmlNode[]): Point {
  const boundary = nodes.find((node) => nodeKindOf(node) === 'boundary')
  if (!boundary) return rightOfEverything(nodes)

  const spec = NODE_SPECS.useCase
  const box = nodeRect(boundary)
  const x = box.x + (box.width - spec.width) / 2

  const inside = nodes.filter(
    (node) =>
      nodeKindOf(node) === 'useCase' &&
      node.position.x >= box.x &&
      node.position.y >= box.y &&
      node.position.x <= box.x + box.width,
  )
  const bottom =
    inside.length === 0
      ? box.y + INSET * 2
      : Math.max(...inside.map((node) => node.position.y + sizeOf(node).height)) + INSET

  // Out of room: put it beside the system rather than overflowing the frame.
  if (bottom + spec.height + INSET > box.y + box.height) {
    return rightOfEverything(nodes)
  }
  return { x, y: bottom }
}

/** Steps a point down-right until no node is already sitting on it. */
export function avoidOverlap(nodes: readonly UmlNode[], point: Point): Point {
  // Compare against what the node factory will actually store, which is the
  // snapped position: an unsnapped candidate never matches anything.
  let candidate = { x: snap(point.x), y: snap(point.y) }
  while (
    nodes.some(
      (node) =>
        Math.abs(node.position.x - candidate.x) < 1 &&
        Math.abs(node.position.y - candidate.y) < 1,
    )
  ) {
    candidate = { x: snap(candidate.x + CASCADE), y: snap(candidate.y + CASCADE) }
  }
  return candidate
}

/** Centres a shape of `kind` on `point`. */
export function centredOn(kind: UmlNodeKind, point: Point): Point {
  const spec = NODE_SPECS[kind]
  return { x: point.x - spec.width / 2, y: point.y - spec.height / 2 }
}
