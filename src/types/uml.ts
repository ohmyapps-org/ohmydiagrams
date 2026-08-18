import type { Edge, Node } from '@xyflow/react'

/** Every shape the palette can drop onto the canvas. */
export type UmlNodeKind =
  | 'actor'
  | 'useCase'
  | 'boundary'
  | 'note'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'

/** Every connector kind. The first four carry UML 2.5 semantics. */
export type UmlEdgeKind =
  | 'association'
  | 'include'
  | 'extend'
  | 'generalization'
  | 'noteLink'
  | 'arrow'

export type LineStyle = 'solid' | 'dashed'

export interface UmlNodeData extends Record<string, unknown> {
  label: string
  /** Overrides the kind's default fill. `null` means "use the theme default". */
  fill: string | null
  stroke: string | null
  fontSize: number
  lineStyle: LineStyle
  /** Rendering order. Boundaries default low so they sit behind everything. */
  z: number
}

export interface Waypoint {
  x: number
  y: number
}

export interface UmlEdgeData extends Record<string, unknown> {
  kind: UmlEdgeKind
  /** Visible text. Defaults to the stereotype for include/extend. */
  label: string
  fontSize: number
  /** User-placed bend points, in flow coordinates, ordered source -> target. */
  waypoints: Waypoint[]
}

export type UmlNode = Node<UmlNodeData>
export type UmlEdge = Edge<UmlEdgeData>

export interface DocumentMeta {
  title: string
  description: string
}

/** Shape of a saved `.json` file and of the localStorage payload. */
export interface UmlDocument {
  version: 1
  meta: DocumentMeta
  nodes: UmlNode[]
  edges: UmlEdge[]
}

/* -------------------------------------------------------------------------- */
/* Per-kind defaults                                                          */
/* -------------------------------------------------------------------------- */

export interface NodeKindSpec {
  /** Spanish palette label. */
  title: string
  defaultLabel: string
  width: number
  height: number
  minWidth: number
  minHeight: number
  /** Actors keep their silhouette proportions when resized. */
  keepAspectRatio: boolean
  resizable: boolean
  z: number
}

export const NODE_SPECS: Record<UmlNodeKind, NodeKindSpec> = {
  boundary: {
    title: 'Límite del sistema',
    defaultLabel: 'Sistema',
    width: 520,
    height: 380,
    minWidth: 200,
    minHeight: 160,
    keepAspectRatio: false,
    resizable: true,
    z: 0,
  },
  actor: {
    title: 'Actor',
    defaultLabel: 'Actor',
    width: 72,
    height: 104,
    minWidth: 48,
    minHeight: 70,
    keepAspectRatio: true,
    resizable: true,
    z: 2,
  },
  useCase: {
    title: 'Caso de uso',
    defaultLabel: 'Registrar venta',
    width: 168,
    height: 76,
    minWidth: 90,
    minHeight: 48,
    keepAspectRatio: false,
    resizable: true,
    z: 2,
  },
  note: {
    title: 'Nota',
    defaultLabel: 'Nota',
    width: 168,
    height: 88,
    minWidth: 80,
    minHeight: 56,
    keepAspectRatio: false,
    resizable: true,
    z: 3,
  },
  rectangle: {
    title: 'Rectángulo',
    defaultLabel: '',
    width: 160,
    height: 88,
    minWidth: 40,
    minHeight: 32,
    keepAspectRatio: false,
    resizable: true,
    z: 2,
  },
  ellipse: {
    title: 'Elipse',
    defaultLabel: '',
    width: 160,
    height: 96,
    minWidth: 40,
    minHeight: 32,
    keepAspectRatio: false,
    resizable: true,
    z: 2,
  },
  diamond: {
    title: 'Rombo',
    defaultLabel: '',
    width: 136,
    height: 104,
    minWidth: 48,
    minHeight: 48,
    keepAspectRatio: false,
    resizable: true,
    z: 2,
  },
  text: {
    title: 'Texto',
    defaultLabel: 'Texto',
    width: 140,
    height: 32,
    minWidth: 40,
    minHeight: 22,
    keepAspectRatio: false,
    resizable: true,
    z: 4,
  },
}

export interface EdgeKindSpec {
  title: string
  /** Auto-suggested label. Empty for plain associations. */
  defaultLabel: string
  lineStyle: LineStyle
  marker: 'none' | 'open' | 'triangle' | 'filled'
}

export const EDGE_SPECS: Record<UmlEdgeKind, EdgeKindSpec> = {
  association: {
    title: 'Asociación',
    defaultLabel: '',
    lineStyle: 'solid',
    marker: 'none',
  },
  include: {
    title: '«include»',
    defaultLabel: '«include»',
    lineStyle: 'dashed',
    marker: 'open',
  },
  extend: {
    title: '«extend»',
    defaultLabel: '«extend»',
    lineStyle: 'dashed',
    marker: 'open',
  },
  generalization: {
    title: 'Generalización',
    defaultLabel: '',
    lineStyle: 'solid',
    marker: 'triangle',
  },
  noteLink: {
    title: 'Conector de nota',
    defaultLabel: '',
    lineStyle: 'dashed',
    marker: 'none',
  },
  arrow: {
    title: 'Flecha',
    defaultLabel: '',
    lineStyle: 'solid',
    marker: 'filled',
  },
}

/** Node kinds that count as generic drawing shapes rather than UML elements. */
export const GENERIC_KINDS: readonly UmlNodeKind[] = [
  'rectangle',
  'ellipse',
  'diamond',
  'text',
]

export function isUmlNodeKind(value: string): value is UmlNodeKind {
  return value in NODE_SPECS
}

export function nodeKindOf(node: UmlNode): UmlNodeKind {
  return (node.type ?? 'rectangle') as UmlNodeKind
}

export function edgeKindOf(edge: UmlEdge): UmlEdgeKind {
  return edge.data?.kind ?? 'association'
}
