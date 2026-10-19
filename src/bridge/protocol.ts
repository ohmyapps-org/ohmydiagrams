import type { UmlDocument, UmlEdgeKind, UmlNodeKind } from '../types/uml'
import type { ValidationItem } from '../uml/validation'

/**
 * Wire protocol between the browser canvas and the MCP server.
 *
 * The browser owns the document; the MCP server owns nothing and only relays
 * calls. Both sides import this file, so a method added here has to be
 * implemented on both or it will not typecheck.
 */

export const BRIDGE_PORT = 7823
export const BRIDGE_PATH = '/bridge'
/** Bumped whenever the shape of a request or response changes. */
export const BRIDGE_VERSION = 1

export interface BridgePoint {
  x: number
  y: number
}

export interface DiagramSummary {
  meta: UmlDocument['meta']
  nodes: {
    id: string
    kind: UmlNodeKind
    label: string
    position: BridgePoint
    width: number
    height: number
    attributes: string[]
    operations: string[]
  }[]
  edges: { id: string; kind: UmlEdgeKind; label: string; source: string; target: string }[]
}

export interface ValidationSummary {
  passed: number
  total: number
  items: Pick<
    ValidationItem,
    'number' | 'title' | 'status' | 'message' | 'suggestion' | 'elementIds'
  >[]
}

/** What pele made of a text diagram's source: the check an agent iterates on. */
export interface SourceVerdict {
  /** True when the text draws. An empty source is not valid. */
  valid: boolean
  /** Diagram family pele detected, when it drew. */
  diagram?: string
  /** Where and why it failed, in a line an agent can act on. */
  error?: string
  line?: number
  column?: number
}

export interface SourceSummary extends SourceVerdict {
  title: string
  source: string
}

/** Every callable method, with its params and its result. */
export interface BridgeMethods {
  getDiagram: {
    params: Record<string, never>
    result: DiagramSummary
  }
  getValidation: {
    params: Record<string, never>
    result: ValidationSummary
  }
  addNode: {
    params: { kind: UmlNodeKind; label?: string; position?: BridgePoint }
    result: { id: string }
  }
  addEdge: {
    params: { kind: UmlEdgeKind; source: string; target: string }
    result: { id: string }
  }
  updateNode: {
    params: {
      id: string
      label?: string
      position?: BridgePoint
      attributes?: string[]
      operations?: string[]
    }
    result: { id: string }
  }
  deleteElements: {
    params: { ids: string[] }
    result: { deleted: number }
  }
  setMeta: {
    params: { title?: string; description?: string }
    result: Record<string, never>
  }
  insertSkeleton: {
    params: { center?: BridgePoint }
    result: { ids: string[] }
  }
  getSource: {
    params: Record<string, never>
    result: SourceSummary
  }
  setSource: {
    params: { source: string }
    result: SourceVerdict
  }
  loadDocument: {
    params: { document: UmlDocument }
    result: Record<string, never>
  }
  clear: {
    params: Record<string, never>
    result: Record<string, never>
  }
}

export type BridgeMethod = keyof BridgeMethods
export type BridgeParams<M extends BridgeMethod> = BridgeMethods[M]['params']
export type BridgeResult<M extends BridgeMethod> = BridgeMethods[M]['result']

export const BRIDGE_METHODS: readonly BridgeMethod[] = [
  'getDiagram',
  'getValidation',
  'addNode',
  'addEdge',
  'updateNode',
  'deleteElements',
  'setMeta',
  'insertSkeleton',
  'getSource',
  'setSource',
  'loadDocument',
  'clear',
]

export interface BridgeRequest<M extends BridgeMethod = BridgeMethod> {
  type: 'request'
  id: string
  method: M
  params: BridgeParams<M>
}

export type BridgeResponse =
  | { type: 'response'; id: string; ok: true; result: unknown }
  | { type: 'response'; id: string; ok: false; error: string }

/** First frame the canvas sends after connecting. */
export interface BridgeHello {
  type: 'hello'
  version: number
  title: string
}

export type BridgeClientMessage = BridgeHello | BridgeResponse
export type BridgeServerMessage = BridgeRequest

export function isBridgeRequest(value: unknown): value is BridgeRequest {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BridgeRequest>
  return (
    candidate.type === 'request' &&
    typeof candidate.id === 'string' &&
    typeof candidate.method === 'string' &&
    BRIDGE_METHODS.includes(candidate.method as BridgeMethod)
  )
}
