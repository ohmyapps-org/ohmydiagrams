import { NODE_SPECS, nodeKindOf, type UmlNode, type Waypoint } from '../types/uml'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export const GRID_SIZE = 10

export function snap(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid
}

/**
 * Authoritative rectangle for a node. React Flow keeps the live size in
 * `measured` while a resize is in flight, so prefer that and fall back to the
 * persisted width/height, then to the kind's default.
 */
export function nodeRect(node: UmlNode): Rect {
  const spec = NODE_SPECS[nodeKindOf(node)]
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? spec.width,
    height: node.measured?.height ?? node.height ?? spec.height,
  }
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function rectRight(rect: Rect): number {
  return rect.x + rect.width
}

export function rectBottom(rect: Rect): number {
  return rect.y + rect.height
}

/** True when `inner` sits entirely within `outer`. */
export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    rectRight(inner) <= rectRight(outer) &&
    rectBottom(inner) <= rectBottom(outer)
  )
}

/** True when the two rectangles share any area (touching edges do not count). */
export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < rectRight(b) &&
    rectRight(a) > b.x &&
    a.y < rectBottom(b) &&
    rectBottom(a) > b.y
  )
}

export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, rectRight(r))
    maxY = Math.max(maxY, rectBottom(r))
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function padRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

/* -------------------------------------------------------------------------- */
/* Border intersection — the heart of the floating-edge routing                */
/* -------------------------------------------------------------------------- */

/**
 * Point where the ray leaving the node's centre toward `toward` crosses the
 * node's silhouette. Ellipses use the true ellipse equation, diamonds the
 * rhombus equation, everything else the bounding box; that keeps connectors
 * visually attached rather than floating off a corner.
 *
 * Both the live canvas and the SVG exporter call this, so exported diagrams are
 * geometrically identical to what the user drew.
 */
export function intersectBorder(node: UmlNode, toward: Point): Point {
  const rect = nodeRect(node)
  const centre = rectCenter(rect)
  const dx = toward.x - centre.x
  const dy = toward.y - centre.y
  if (dx === 0 && dy === 0) return centre

  const a = rect.width / 2
  const b = rect.height / 2
  const kind = nodeKindOf(node)

  let t: number
  if (kind === 'useCase' || kind === 'ellipse') {
    t = 1 / Math.hypot(dx / a, dy / b)
  } else if (kind === 'diamond') {
    t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b)
  } else {
    // Axis-aligned box: whichever side the ray reaches first.
    const tx = dx === 0 ? Infinity : a / Math.abs(dx)
    const ty = dy === 0 ? Infinity : b / Math.abs(dy)
    t = Math.min(tx, ty)
  }

  return { x: centre.x + dx * t, y: centre.y + dy * t }
}

/* -------------------------------------------------------------------------- */
/* Edge routing                                                               */
/* -------------------------------------------------------------------------- */

export interface EdgeGeometry {
  /** Full polyline, source anchor first, target anchor last. */
  points: Point[]
  /** SVG path data for the polyline. */
  path: string
  /** Point at half the polyline's arc length — where the label goes. */
  labelPoint: Point
  source: Point
  target: Point
}

function polylinePath(points: Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')
}

function midpointAlong(points: Point[]): Point {
  const segments: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    const len = Math.hypot(
      points[i]!.x - points[i - 1]!.x,
      points[i]!.y - points[i - 1]!.y,
    )
    segments.push(len)
    total += len
  }
  if (total === 0) return points[0]!

  let remaining = total / 2
  for (let i = 0; i < segments.length; i += 1) {
    const len = segments[i]!
    if (remaining <= len) {
      const ratio = len === 0 ? 0 : remaining / len
      const from = points[i]!
      const to = points[i + 1]!
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      }
    }
    remaining -= len
  }
  return points[points.length - 1]!
}

/**
 * Routes an edge from `source` to `target` through the user's bend points.
 * Anchors are recomputed from the node silhouettes every time, so dragging a
 * node keeps the line glued to its border.
 */
export function buildEdgeGeometry(
  source: UmlNode,
  target: UmlNode,
  waypoints: readonly Waypoint[] = [],
): EdgeGeometry {
  const bends = waypoints.map((w) => ({ x: w.x, y: w.y }))
  const sourceTowards = bends[0] ?? rectCenter(nodeRect(target))
  const targetTowards = bends[bends.length - 1] ?? rectCenter(nodeRect(source))

  const sourcePoint = intersectBorder(source, sourceTowards)
  const targetPoint = intersectBorder(target, targetTowards)
  const points = [sourcePoint, ...bends, targetPoint]

  return {
    points,
    path: polylinePath(points),
    labelPoint: midpointAlong(points),
    source: sourcePoint,
    target: targetPoint,
  }
}

/**
 * Self-referencing edges (an invalid but drawable state we must still render)
 * get a small loop above the node so the user can see and delete them.
 */
export function buildSelfLoopGeometry(node: UmlNode): EdgeGeometry {
  const rect = nodeRect(node)
  const left = { x: rect.x + rect.width * 0.3, y: rect.y }
  const right = { x: rect.x + rect.width * 0.7, y: rect.y }
  const peak = { x: rectCenter(rect).x, y: rect.y - 52 }
  return {
    points: [left, peak, right],
    path: `M${left.x.toFixed(2)},${left.y.toFixed(2)} Q${peak.x.toFixed(2)},${(
      peak.y - 20
    ).toFixed(2)} ${right.x.toFixed(2)},${right.y.toFixed(2)}`,
    labelPoint: { x: peak.x, y: peak.y - 6 },
    source: left,
    target: right,
  }
}

/** Nearest point on segment AB to P, used to pick where a new bend lands. */
export function closestPointOnSegment(a: Point, b: Point, p: Point): Point {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lengthSq = abx * abx + aby * aby
  if (lengthSq === 0) return a
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq),
  )
  return { x: a.x + abx * t, y: a.y + aby * t }
}

/**
 * Index at which a new bend point should be inserted so that the polyline keeps
 * its shape: the segment whose closest point to `click` is nearest.
 */
export function bendInsertIndex(points: readonly Point[], click: Point): number {
  let best = 0
  let bestDistance = Infinity
  for (let i = 1; i < points.length; i += 1) {
    const candidate = closestPointOnSegment(points[i - 1]!, points[i]!, click)
    const distance = Math.hypot(candidate.x - click.x, candidate.y - click.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i - 1
    }
  }
  return best
}

/* -------------------------------------------------------------------------- */
/* Align & distribute                                                         */
/* -------------------------------------------------------------------------- */

export type AlignAxis =
  | 'left'
  | 'centerX'
  | 'right'
  | 'top'
  | 'centerY'
  | 'bottom'

/** New positions keyed by node id. Nodes not in the selection are untouched. */
export function alignPositions(
  nodes: readonly UmlNode[],
  axis: AlignAxis,
): Map<string, Point> {
  const result = new Map<string, Point>()
  const rects = nodes.map(nodeRect)
  const bounds = boundsOf(rects)
  if (!bounds) return result

  nodes.forEach((node, index) => {
    const rect = rects[index]!
    let { x, y } = node.position
    switch (axis) {
      case 'left':
        x = bounds.x
        break
      case 'centerX':
        x = rectCenter(bounds).x - rect.width / 2
        break
      case 'right':
        x = rectRight(bounds) - rect.width
        break
      case 'top':
        y = bounds.y
        break
      case 'centerY':
        y = rectCenter(bounds).y - rect.height / 2
        break
      case 'bottom':
        y = rectBottom(bounds) - rect.height
        break
    }
    result.set(node.id, { x, y })
  })
  return result
}

/** Evens out the gaps between three or more nodes along one axis. */
export function distributePositions(
  nodes: readonly UmlNode[],
  axis: 'horizontal' | 'vertical',
): Map<string, Point> {
  const result = new Map<string, Point>()
  if (nodes.length < 3) return result

  const entries = nodes
    .map((node) => ({ node, rect: nodeRect(node) }))
    .sort((a, b) =>
      axis === 'horizontal' ? a.rect.x - b.rect.x : a.rect.y - b.rect.y,
    )

  const first = entries[0]!
  const last = entries[entries.length - 1]!
  const span =
    axis === 'horizontal'
      ? rectRight(last.rect) - first.rect.x
      : rectBottom(last.rect) - first.rect.y
  const occupied = entries.reduce(
    (sum, e) => sum + (axis === 'horizontal' ? e.rect.width : e.rect.height),
    0,
  )
  const gap = (span - occupied) / (entries.length - 1)

  let cursor = axis === 'horizontal' ? first.rect.x : first.rect.y
  for (const entry of entries) {
    result.set(entry.node.id, {
      x: axis === 'horizontal' ? cursor : entry.node.position.x,
      y: axis === 'vertical' ? cursor : entry.node.position.y,
    })
    cursor += (axis === 'horizontal' ? entry.rect.width : entry.rect.height) + gap
  }
  return result
}
