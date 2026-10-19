import type { Edge, Node } from '@xyflow/react'
import type { DiagramKind } from './document'

/** Every shape the palette can drop onto the canvas. */
export type UmlNodeKind =
  | 'actor'
  | 'useCase'
  | 'boundary'
  | 'class'
  | 'interface'
  | 'enumeration'
  | 'note'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'

/** Classifiers that belong on a class diagram. */
export const CLASSIFIER_KINDS: readonly UmlNodeKind[] = [
  'class',
  'interface',
  'enumeration',
]

export function isClassifierKind(kind: UmlNodeKind): boolean {
  return kind === 'class' || kind === 'interface' || kind === 'enumeration'
}

/** «interface» / «enumeration» drawn above the name. `null` for a plain class. */
export function classifierStereotype(kind: UmlNodeKind): string | null {
  if (kind === 'interface') return 'interface'
  if (kind === 'enumeration') return 'enumeration'
  return null
}

/** Attribute and operation lines, dropping blanks left by the editor. */
export function memberLines(values: readonly string[] | undefined): string[] {
  if (!values) return []
  return values.map((line) => line.trimEnd()).filter((line) => line.trim().length > 0)
}

/** Every connector kind. The first four carry use-case UML 2.5 semantics. */
export type UmlEdgeKind =
  | 'association'
  | 'include'
  | 'extend'
  | 'generalization'
  | 'aggregation'
  | 'composition'
  | 'dependency'
  | 'realization'
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
  /** Class-diagram attribute (or enumeration literal) lines. */
  attributes: string[]
  /** Class-diagram operation lines. */
  operations: string[]
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
  /** Files written before kinds existed carry none; they load as use cases. */
  kind: DiagramKind
  meta: DocumentMeta
  nodes: UmlNode[]
  edges: UmlEdge[]
  /** Mermaid text of a `text` diagram. Drawn kinds have none. */
  source?: string
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

/** The one z below the edge layer. See the boundary spec for why. */
export const BOUNDARY_Z = -1

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
    /**
     * Below zero on purpose: React Flow paints the edge layer before the node
     * layer, so only a negative z puts the boundary's opaque pane *under* the
     * relationships that cross it. Everything else starts at 2.
     */
    z: BOUNDARY_Z,
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
  class: {
    title: 'Clase',
    defaultLabel: 'Clase',
    width: 200,
    height: 168,
    minWidth: 140,
    minHeight: 96,
    keepAspectRatio: false,
    resizable: true,
    z: 2,
  },
  interface: {
    title: 'Interfaz',
    defaultLabel: 'Interfaz',
    width: 200,
    height: 148,
    minWidth: 140,
    minHeight: 88,
    keepAspectRatio: false,
    resizable: true,
    z: 2,
  },
  enumeration: {
    title: 'Enumeración',
    defaultLabel: 'Enumeración',
    width: 180,
    height: 140,
    minWidth: 120,
    minHeight: 80,
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

export type EndMarker = 'none' | 'open' | 'triangle' | 'filled'
export type StartMarker = 'none' | 'diamond' | 'diamondFilled'

export interface EdgeKindSpec {
  title: string
  /** Auto-suggested label. Empty for plain associations. */
  defaultLabel: string
  lineStyle: LineStyle
  marker: EndMarker
  /** Aggregation/composition sit the diamond on the "whole" (source) end. */
  startMarker: StartMarker
}

export const EDGE_SPECS: Record<UmlEdgeKind, EdgeKindSpec> = {
  association: {
    title: 'Asociación',
    defaultLabel: '',
    lineStyle: 'solid',
    marker: 'none',
    startMarker: 'none',
  },
  include: {
    title: '«include»',
    defaultLabel: '«include»',
    lineStyle: 'dashed',
    marker: 'open',
    startMarker: 'none',
  },
  extend: {
    title: '«extend»',
    defaultLabel: '«extend»',
    lineStyle: 'dashed',
    marker: 'open',
    startMarker: 'none',
  },
  generalization: {
    title: 'Generalización',
    defaultLabel: '',
    lineStyle: 'solid',
    marker: 'triangle',
    startMarker: 'none',
  },
  aggregation: {
    title: 'Agregación',
    defaultLabel: '',
    lineStyle: 'solid',
    marker: 'none',
    startMarker: 'diamond',
  },
  composition: {
    title: 'Composición',
    defaultLabel: '',
    lineStyle: 'solid',
    marker: 'none',
    startMarker: 'diamondFilled',
  },
  dependency: {
    title: 'Dependencia',
    defaultLabel: '',
    lineStyle: 'dashed',
    marker: 'open',
    startMarker: 'none',
  },
  realization: {
    title: 'Realización',
    defaultLabel: '',
    lineStyle: 'dashed',
    marker: 'triangle',
    startMarker: 'none',
  },
  noteLink: {
    title: 'Conector de nota',
    defaultLabel: '',
    lineStyle: 'dashed',
    marker: 'none',
    startMarker: 'none',
  },
  arrow: {
    title: 'Flecha',
    defaultLabel: '',
    lineStyle: 'solid',
    marker: 'filled',
    startMarker: 'none',
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
