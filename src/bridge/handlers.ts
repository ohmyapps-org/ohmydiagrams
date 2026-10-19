import { diagramType } from '../diagrams/registry'
import { MAX_SOURCE_CHARS, coerceDocument } from '../export/json'
import { useDocument } from '../store/document'
import { describeFailure, renderMermaid } from '../text/mermaid'
import {
  NODE_SPECS,
  edgeKindOf,
  isUmlNodeKind,
  nodeKindOf,
  type UmlEdgeKind,
  type UmlNodeData,
} from '../types/uml'
import { rightOfEverything } from '../uml/placement'
import { canConnect, orientConnection } from '../uml/rules'
import { SKELETONS } from '../uml/templates'
import type {
  BridgeMethod,
  BridgeParams,
  BridgeResult,
  DiagramSummary,
  SourceVerdict,
  ValidationSummary,
} from './protocol'

type Handler<M extends BridgeMethod> = (
  params: BridgeParams<M>,
) => BridgeResult<M> | Promise<BridgeResult<M>>

type HandlerMap = { [M in BridgeMethod]: Handler<M> }

const TEXT_ONLY = 'Este diagrama es de texto Mermaid: usá get_source y set_source.'
const DRAWN_ONLY =
  'Este diagrama se dibuja en el lienzo, no tiene texto Mermaid. Usá get_diagram y las herramientas de formas.'

/** Drawn-diagram tools make no sense on a text diagram, and say so. */
function requireDrawn(): void {
  if (useDocument.getState().kind === 'text') throw new Error(TEXT_ONLY)
}

function requireText(): void {
  if (useDocument.getState().kind !== 'text') throw new Error(DRAWN_ONLY)
}

async function verdictOf(source: string): Promise<SourceVerdict> {
  const result = await renderMermaid(source)
  if (result.ok) return { valid: true, diagram: result.type }
  if (result.code === 'empty') return { valid: false, error: 'El texto está vacío.' }
  return {
    valid: false,
    error: describeFailure(result),
    ...(result.line > 0 ? { line: result.line, column: result.column } : {}),
  }
}

function requireNode(id: unknown) {
  if (typeof id !== 'string') throw new Error('Falta el id del elemento.')
  const node = useDocument.getState().nodes.find((item) => item.id === id)
  if (!node) throw new Error(`No existe ningún elemento con id "${id}".`)
  return node
}

function summarise(): DiagramSummary {
  const { nodes, edges, meta } = useDocument.getState()
  return {
    meta,
    nodes: nodes.map((node) => {
      const kind = nodeKindOf(node)
      const spec = NODE_SPECS[kind]
      return {
        id: node.id,
        kind,
        label: node.data.label,
        position: node.position,
        width: node.width ?? spec.width,
        height: node.height ?? spec.height,
        attributes: node.data.attributes ?? [],
        operations: node.data.operations ?? [],
      }
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      kind: edgeKindOf(edge),
      label: edge.data?.label ?? '',
      source: edge.source,
      target: edge.target,
    })),
  }
}

function report(): ValidationSummary {
  const { kind, nodes, edges, meta } = useDocument.getState()
  const result = diagramType(kind).validate(nodes, edges, meta)
  return {
    passed: result.passed,
    total: result.total,
    items: result.items.map((item) => ({
      number: item.number,
      title: item.title,
      status: item.status,
      message: item.message,
      suggestion: item.suggestion,
      elementIds: item.elementIds,
    })),
  }
}

/**
 * Every call an MCP agent can make against the open canvas. Each one goes
 * through the same store actions the UI uses, so agent edits land on the same
 * undo stack and autosave as hand edits.
 */
const HANDLERS: HandlerMap = {
  getDiagram: () => {
    requireDrawn()
    return summarise()
  },

  getValidation: () => {
    requireDrawn()
    return report()
  },

  getSource: async () => {
    requireText()
    const { source, meta } = useDocument.getState()
    return { title: meta.title, source, ...(await verdictOf(source)) }
  },

  setSource: async ({ source }) => {
    requireText()
    if (typeof source !== 'string') throw new Error('Falta el texto Mermaid.')
    if (source.length > MAX_SOURCE_CHARS) {
      throw new Error(`El texto supera los ${MAX_SOURCE_CHARS} caracteres.`)
    }
    // Saved even when it does not draw: the person sees the broken text and
    // the error beside it, and the agent gets the same verdict to fix it.
    useDocument.getState().setSource(source)
    return verdictOf(source)
  },

  addNode: ({ kind, label, position }) => {
    requireDrawn()
    if (!isUmlNodeKind(kind)) throw new Error(`"${kind}" no es un tipo de forma.`)
    const node = useDocument
      .getState()
      .addNode(
        kind,
        position ?? rightOfEverything(useDocument.getState().nodes),
        label,
      )
    return { id: node.id }
  },

  addEdge: ({ kind, source, target }) => {
    requireDrawn()
    const from = requireNode(source)
    const to = requireNode(target)
    const verdict = canConnect(kind as UmlEdgeKind, from, to)
    if (!verdict.ok) {
      throw new Error(verdict.reason ?? 'Esa relación no es válida en UML 2.5.')
    }
    const oriented = orientConnection(kind as UmlEdgeKind, from, to)
    const store = useDocument.getState()
    store.addEdge(kind as UmlEdgeKind, oriented.source.id, oriented.target.id)
    const created = useDocument.getState().edges.at(-1)
    return { id: created?.id ?? '' }
  },

  updateNode: ({ id, label, position, attributes, operations }) => {
    requireDrawn()
    const node = requireNode(id)
    const store = useDocument.getState()
    const patch: Partial<UmlNodeData> = {}
    if (typeof label === 'string') patch.label = label
    if (attributes) patch.attributes = attributes
    if (operations) patch.operations = operations
    if (Object.keys(patch).length > 0) store.updateNodeData(node.id, patch)
    if (position) store.moveNode(node.id, position)
    return { id: node.id }
  },

  deleteElements: ({ ids }) => {
    requireDrawn()
    if (!Array.isArray(ids) || ids.length === 0) return { deleted: 0 }
    const store = useDocument.getState()
    const before = store.nodes.length + store.edges.length
    store.selectOnly(ids)
    store.deleteSelection()
    const after = useDocument.getState()
    return { deleted: before - (after.nodes.length + after.edges.length) }
  },

  setMeta: ({ title, description }) => {
    useDocument.getState().setMeta({
      ...(typeof title === 'string' ? { title } : {}),
      ...(typeof description === 'string' ? { description } : {}),
    })
    return {}
  },

  insertSkeleton: ({ center }) => {
    requireDrawn()
    const kind = useDocument.getState().kind
    const skeleton = SKELETONS[kind]
    if (!skeleton) {
      throw new Error(
        `${diagramType(kind).title} todavía no tiene un diagrama de ejemplo.`,
      )
    }
    const fragment = skeleton(center ?? { x: 0, y: 0 })
    useDocument.getState().insertFragment(fragment)
    return { ids: fragment.nodes.map((node) => node.id) }
  },

  loadDocument: ({ document }) => {
    // Reuse the importer's validation: an agent is as untrusted as a file.
    useDocument.getState().loadDocument(coerceDocument(document))
    return {}
  },

  clear: () => {
    if (useDocument.getState().kind === 'text') {
      useDocument.getState().setSource('')
      return {}
    }
    useDocument.getState().resetDocument()
    return {}
  },
}

export function runBridgeMethod<M extends BridgeMethod>(
  method: M,
  params: BridgeParams<M>,
): BridgeResult<M> | Promise<BridgeResult<M>> {
  return HANDLERS[method](params)
}
