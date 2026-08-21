import { isDiagramKind } from '../types/document'
import {
  BOUNDARY_Z,
  EDGE_SPECS,
  NODE_SPECS,
  isUmlNodeKind,
  type UmlDocument,
  type UmlEdge,
  type UmlEdgeData,
  type UmlEdgeKind,
  type UmlNode,
  type UmlNodeData,
  type UmlNodeKind,
  type Waypoint,
} from '../types/uml'

/**
 * Parses a saved document. Imported files are treated as untrusted: anything
 * malformed is rejected outright rather than half-loaded, and stale selection
 * state is dropped.
 */
export function parseDocument(raw: string): UmlDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('El archivo no es JSON válido.')
  }
  return coerceDocument(parsed)
}

/** Same validation, for a value that was already parsed (the local library). */
export function coerceDocument(parsed: unknown): UmlDocument {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('El archivo no contiene un diagrama.')
  }

  const candidate = parsed as Partial<UmlDocument>
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    throw new Error('El archivo no tiene la estructura de un diagrama.')
  }

  const nodes = candidate.nodes.filter(
    (node): node is UmlNode =>
      typeof node?.id === 'string' &&
      typeof node.type === 'string' &&
      isUmlNodeKind(node.type) &&
      typeof node.position?.x === 'number' &&
      typeof node.position?.y === 'number',
  )

  const ids = new Set(nodes.map((node) => node.id))
  const edges = candidate.edges.filter(
    (edge): edge is UmlEdge =>
      typeof edge?.id === 'string' && ids.has(edge.source) && ids.has(edge.target),
  )

  if (nodes.length === 0 && candidate.nodes.length > 0) {
    throw new Error('Ningún elemento del archivo pudo interpretarse.')
  }

  return {
    version: 1,
    // Files written before kinds existed are use case diagrams.
    kind: isDiagramKind(candidate.kind) ? candidate.kind : 'useCase',
    meta: {
      title: typeof candidate.meta?.title === 'string' ? candidate.meta.title : '',
      description:
        typeof candidate.meta?.description === 'string'
          ? candidate.meta.description
          : '',
    },
    nodes: nodes.map((node) => {
      const data = coerceNodeData(node.data, node.type as UmlNodeKind)
      // `data.z` is the document's own order; React Flow reads `zIndex`. Deriving
      // one from the other here means a file can never load with the two out of
      // step, whatever wrote it.
      return { ...node, selected: false, zIndex: data.z, data }
    }),
    edges: edges.map((edge) => ({
      ...edge,
      type: 'uml',
      selected: false,
      data: coerceEdgeData(edge.data),
    })),
  }
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function colour(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function coerceNodeData(raw: unknown, kind: UmlNodeKind): UmlNodeData {
  const data = (raw ?? {}) as Record<string, unknown>
  return {
    label: str(data.label, NODE_SPECS[kind].defaultLabel),
    fill: colour(data.fill),
    stroke: colour(data.stroke),
    fontSize: num(data.fontSize, 14),
    lineStyle: data.lineStyle === 'dashed' ? 'dashed' : 'solid',
    z: coerceZ(data.z, kind),
  }
}

/**
 * Boundaries used to sit at z 0, which is above the edge layer: their pane
 * covered every relationship crossing them. Files written back then carry that
 * exact value, so it is read as "the old default" and moved to the new one.
 */
function coerceZ(raw: unknown, kind: UmlNodeKind): number {
  const z = num(raw, NODE_SPECS[kind].z)
  return kind === 'boundary' && z === 0 ? BOUNDARY_Z : z
}

function coerceEdgeData(raw: unknown): UmlEdgeData {
  const data = (raw ?? {}) as Record<string, unknown>
  const kind =
    typeof data.kind === 'string' && data.kind in EDGE_SPECS
      ? (data.kind as UmlEdgeKind)
      : 'association'
  const waypoints = Array.isArray(data.waypoints)
    ? data.waypoints
        .filter(
          (point): point is Waypoint =>
            typeof (point as Waypoint)?.x === 'number' &&
            typeof (point as Waypoint)?.y === 'number',
        )
        .map((point) => ({ x: point.x, y: point.y }))
    : []

  return {
    kind,
    label: str(data.label, EDGE_SPECS[kind].defaultLabel),
    fontSize: num(data.fontSize, 12),
    waypoints,
  }
}

export function serializeDocument(doc: UmlDocument): string {
  return JSON.stringify(doc, null, 2)
}
