import type { DocumentMeta, UmlEdge, UmlNode } from '../types/uml'

export interface Snapshot {
  nodes: UmlNode[]
  edges: UmlEdge[]
  meta: DocumentMeta
}

export const HISTORY_LIMIT = 100

export interface HistoryCarrier {
  nodes: UmlNode[]
  edges: UmlEdge[]
  meta: DocumentMeta
  past: Snapshot[]
  future: Snapshot[]
}

export function takeSnapshot(state: HistoryCarrier): Snapshot {
  return {
    // Nodes and edges are replaced wholesale by every action, but their `data`
    // objects are shared, so clone one level deeper than the arrays.
    nodes: state.nodes.map((node) => ({ ...node, data: { ...node.data } })),
    edges: state.edges.map((edge) => ({
      ...edge,
      data: edge.data
        ? { ...edge.data, waypoints: edge.data.waypoints.map((w) => ({ ...w })) }
        : undefined,
    })),
    meta: { ...state.meta },
  }
}

export function pushHistory(
  state: HistoryCarrier,
  snapshot: Snapshot,
): Pick<HistoryCarrier, 'past' | 'future'> {
  const past = [...state.past, snapshot]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [] }
}
