import type { LucideIcon } from 'lucide-react'
import type { DiagramKind } from '../types/document'
import type {
  DocumentMeta,
  UmlEdge,
  UmlEdgeKind,
  UmlNode,
  UmlNodeKind,
} from '../types/uml'
import type { GuideStep } from '../uml/guide'
import type { ValidationReport } from '../uml/validation'

export interface PaletteShape {
  kind: UmlNodeKind
  icon: LucideIcon
  hint: string
}

export interface PaletteConnector {
  kind: UmlEdgeKind
  icon: LucideIcon
}

export interface PaletteGroup {
  title: string
  shapes?: readonly PaletteShape[]
  connectors?: readonly PaletteConnector[]
}

/**
 * Everything that changes from one family of diagram to the next. The canvas,
 * the store, the exporters and the MCP bridge never branch on the kind: they
 * read it from here.
 */
export interface DiagramType {
  kind: DiagramKind
  title: string
  description: string
  icon: LucideIcon
  /**
   * `false` while a kind has no notation of its own: it draws with the generic
   * shapes and its checklist is empty, but it saves, exports, and opens like
   * any other diagram.
   */
  ready: boolean
  palette: readonly PaletteGroup[]
  guide: readonly GuideStep[]
  /** Whether the requirements reader proposes elements for this kind. */
  requirements: boolean
  /** Connector armed when a document of this kind opens. */
  defaultEdgeKind: UmlEdgeKind
  validate: (
    nodes: readonly UmlNode[],
    edges: readonly UmlEdge[],
    meta: DocumentMeta,
  ) => ValidationReport
}
