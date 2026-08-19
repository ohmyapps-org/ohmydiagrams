import { parseDocument } from '../export/json'
import { useDocument } from '../store/document'
import {
  NODE_SPECS,
  edgeKindOf,
  isUmlNodeKind,
  nodeKindOf,
  type UmlEdgeKind,
} from '../types/uml'
import { rightOfEverything } from '../uml/placement'
import { canConnect, orientConnection } from '../uml/rules'
import { createUseCaseSkeleton } from '../uml/templates'
import { validate } from '../uml/validation'
import type {
  BridgeMethod,
  BridgeParams,
  BridgeResult,
  DiagramSummary,
  ValidationSummary,
} from './protocol'

type Handler<M extends BridgeMethod> = (params: BridgeParams<M>) => BridgeResult<M>

type HandlerMap = { [M in BridgeMethod]: Handler<M> }

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
  const { nodes, edges, meta } = useDocument.getState()
  const result = validate(nodes, edges, meta)
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
  getDiagram: () => summarise(),

  getValidation: () => report(),

  addNode: ({ kind, label, position }) => {
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

  updateNode: ({ id, label, position }) => {
    const node = requireNode(id)
    const store = useDocument.getState()
    if (typeof label === 'string') store.updateNodeData(node.id, { label })
    if (position) store.moveNode(node.id, position)
    return { id: node.id }
  },

  deleteElements: ({ ids }) => {
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
    const fragment = createUseCaseSkeleton(center ?? { x: 0, y: 0 })
    useDocument.getState().insertFragment(fragment)
    return { ids: fragment.nodes.map((node) => node.id) }
  },

  loadDocument: ({ document }) => {
    // Reuse the importer's validation: an agent is as untrusted as a file.
    useDocument.getState().loadDocument(parseDocument(JSON.stringify(document)))
    return {}
  },

  clear: () => {
    useDocument.getState().resetDocument()
    return {}
  },
}

export function runBridgeMethod<M extends BridgeMethod>(
  method: M,
  params: BridgeParams<M>,
): BridgeResult<M> {
  return HANDLERS[method](params)
}
