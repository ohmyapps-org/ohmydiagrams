import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  EDGE_SPECS,
  NODE_SPECS,
  type DocumentMeta,
  type UmlDocument,
  type UmlEdge,
  type UmlEdgeData,
  type UmlEdgeKind,
  type UmlNode,
  type UmlNodeData,
  type UmlNodeKind,
  edgeKindOf,
  nodeKindOf,
} from '../types/uml'
import {
  alignPositions,
  distributePositions,
  snap,
  type AlignAxis,
  type Point,
} from '../uml/geometry'
import type { Fragment } from '../uml/templates'
import { pushHistory, takeSnapshot, type Snapshot } from './history'
import { createDebouncedStorage } from './storage'

const STORAGE_KEY = 'ohmydiagrams:document:v1'
const AUTOSAVE_DELAY_MS = 500
const PASTE_OFFSET = 24

let idCounter = 0

function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`
}

export function createNode(
  kind: UmlNodeKind,
  position: Point,
  label?: string,
): UmlNode {
  const spec = NODE_SPECS[kind]
  const data: UmlNodeData = {
    label: label ?? spec.defaultLabel,
    fill: null,
    stroke: null,
    fontSize: kind === 'boundary' ? 15 : 14,
    lineStyle: 'solid',
    z: spec.z,
  }
  return {
    id: nextId(kind),
    type: kind,
    position: { x: snap(position.x), y: snap(position.y) },
    width: spec.width,
    height: spec.height,
    data,
    zIndex: spec.z,
    selected: false,
  }
}

export function createEdge(
  kind: UmlEdgeKind,
  source: string,
  target: string,
): UmlEdge {
  const spec = EDGE_SPECS[kind]
  const data: UmlEdgeData = {
    kind,
    label: spec.defaultLabel,
    fontSize: 12,
    waypoints: [],
  }
  return { id: nextId(kind), type: 'uml', source, target, data, selected: false }
}

export interface UiState {
  snapToGrid: boolean
  showGrid: boolean
  /** Connector kind armed in the palette; used for every new connection. */
  pendingEdgeKind: UmlEdgeKind
  /** Tab B manual checkmarks, keyed by step id. */
  guideChecks: Record<string, boolean>
  /** Element ids the checklist asked us to highlight. */
  flagged: string[]
  /** Node or edge whose label is currently open for inline editing. */
  editingId: string | null
}

interface Clipboard {
  nodes: UmlNode[]
  edges: UmlEdge[]
}

export interface DocumentStore {
  nodes: UmlNode[]
  edges: UmlEdge[]
  meta: DocumentMeta
  past: Snapshot[]
  future: Snapshot[]
  ui: UiState
  clipboard: Clipboard | null
  /** Snapshot captured at the start of a drag/resize gesture. */
  transaction: Snapshot | null

  onNodesChange: (changes: NodeChange<UmlNode>[]) => void
  onEdgesChange: (changes: EdgeChange<UmlEdge>[]) => void

  beginTransaction: () => void
  endTransaction: () => void
  commit: () => void
  undo: () => void
  redo: () => void

  addNode: (kind: UmlNodeKind, position: Point, label?: string) => UmlNode
  addEdge: (kind: UmlEdgeKind, source: string, target: string) => void
  /** Drops a ready-made group of elements as one undoable step. */
  insertFragment: (fragment: Fragment) => void
  updateNodeData: (id: string, patch: Partial<UmlNodeData>) => void
  moveNode: (id: string, position: Point) => void
  updateNodeKind: (id: string, kind: UmlNodeKind) => void
  updateEdgeData: (id: string, patch: Partial<UmlEdgeData>) => void
  updateEdgeKind: (id: string, kind: UmlEdgeKind) => void
  reverseEdge: (id: string) => void
  setEdgeWaypoints: (id: string, waypoints: Point[]) => void

  deleteSelection: () => void
  duplicateSelection: () => void
  copySelection: () => void
  paste: () => void
  selectAll: () => void
  selectOnly: (ids: string[]) => void
  clearSelection: () => void
  align: (axis: AlignAxis) => void
  distribute: (axis: 'horizontal' | 'vertical') => void
  bringToFront: (ids: string[]) => void
  sendToBack: (ids: string[]) => void

  setMeta: (patch: Partial<DocumentMeta>) => void
  setUi: (patch: Partial<UiState>) => void
  toggleGuideStep: (stepId: string) => void
  setFlagged: (ids: string[]) => void

  loadDocument: (doc: UmlDocument) => void
  resetDocument: () => void
  toDocument: () => UmlDocument
}

const INITIAL_META: DocumentMeta = { title: '', description: '' }

const INITIAL_UI: UiState = {
  snapToGrid: true,
  showGrid: true,
  pendingEdgeKind: 'association',
  guideChecks: {},
  flagged: [],
  editingId: null,
}

function withSelection<T extends { id: string; selected?: boolean }>(
  items: T[],
  selectedIds: ReadonlySet<string>,
): T[] {
  return items.map((item) =>
    item.selected === selectedIds.has(item.id)
      ? item
      : { ...item, selected: selectedIds.has(item.id) },
  )
}

export const useDocument = create<DocumentStore>()(
  persist(
    (set, get) => {
      /** Applies `producer` as one undoable step. */
      const mutate = (
        producer: (state: DocumentStore) => Partial<DocumentStore> | null,
      ): void => {
        const state = get()
        const patch = producer(state)
        if (!patch) return
        set({ ...patch, ...pushHistory(state, takeSnapshot(state)) })
      }

      return {
        nodes: [],
        edges: [],
        meta: INITIAL_META,
        past: [],
        future: [],
        ui: INITIAL_UI,
        clipboard: null,
        transaction: null,

        onNodesChange: (changes) =>
          set((state) => ({
            nodes: applyNodeChanges(changes, state.nodes),
          })),

        onEdgesChange: (changes) =>
          set((state) => ({
            edges: applyEdgeChanges(changes, state.edges),
          })),

        // A drag emits a position change per frame; capturing at gesture start
        // and pushing at gesture end keeps it to one undo step.
        beginTransaction: () => {
          if (get().transaction) return
          set({ transaction: takeSnapshot(get()) })
        },

        endTransaction: () => {
          const state = get()
          if (!state.transaction) return
          set({
            transaction: null,
            ...pushHistory(state, state.transaction),
          })
        },

        commit: () => {
          const state = get()
          set(pushHistory(state, takeSnapshot(state)))
        },

        undo: () => {
          const state = get()
          const previous = state.past[state.past.length - 1]
          if (!previous) return
          set({
            past: state.past.slice(0, -1),
            future: [...state.future, takeSnapshot(state)],
            nodes: previous.nodes,
            edges: previous.edges,
            meta: previous.meta,
          })
        },

        redo: () => {
          const state = get()
          const next = state.future[state.future.length - 1]
          if (!next) return
          set({
            future: state.future.slice(0, -1),
            past: [...state.past, takeSnapshot(state)],
            nodes: next.nodes,
            edges: next.edges,
            meta: next.meta,
          })
        },

        addNode: (kind, position, label) => {
          const node = createNode(kind, position, label)
          mutate((state) => ({
            nodes: [
              ...state.nodes.map((n) =>
                n.selected ? { ...n, selected: false } : n,
              ),
              { ...node, selected: true },
            ],
          }))
          return node
        },

        addEdge: (kind, source, target) =>
          mutate((state) => ({
            edges: [...state.edges, createEdge(kind, source, target)],
          })),

        insertFragment: (fragment) =>
          mutate((state) => {
            if (fragment.nodes.length === 0) return null
            return {
              nodes: [
                ...state.nodes.map((node) =>
                  node.selected ? { ...node, selected: false } : node,
                ),
                ...fragment.nodes.map((node) => ({ ...node, selected: true })),
              ],
              edges: [...state.edges, ...fragment.edges],
            }
          }),

        moveNode: (id, position) =>
          mutate((state) => ({
            nodes: state.nodes.map((node) =>
              node.id === id
                ? { ...node, position: { x: snap(position.x), y: snap(position.y) } }
                : node,
            ),
          })),

        updateNodeData: (id, patch) =>
          mutate((state) => ({
            nodes: state.nodes.map((node) =>
              node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
            ),
          })),

        updateNodeKind: (id, kind) =>
          mutate((state) => {
            const spec = NODE_SPECS[kind]
            return {
              nodes: state.nodes.map((node) =>
                node.id === id
                  ? {
                      ...node,
                      type: kind,
                      // Silhouettes differ too much to keep the old box.
                      width: spec.width,
                      height: spec.height,
                      zIndex: spec.z,
                      data: { ...node.data, z: spec.z },
                    }
                  : node,
              ),
            }
          }),

        updateEdgeData: (id, patch) =>
          mutate((state) => ({
            edges: state.edges.map((edge) =>
              edge.id === id && edge.data
                ? { ...edge, data: { ...edge.data, ...patch } }
                : edge,
            ),
          })),

        updateEdgeKind: (id, kind) =>
          mutate((state) => ({
            edges: state.edges.map((edge) => {
              if (edge.id !== id || !edge.data) return edge
              const previousDefault = EDGE_SPECS[edgeKindOf(edge)].defaultLabel
              // Keep a hand-written label, replace an auto-suggested one.
              const label =
                edge.data.label === previousDefault
                  ? EDGE_SPECS[kind].defaultLabel
                  : edge.data.label
              return { ...edge, data: { ...edge.data, kind, label } }
            }),
          })),

        reverseEdge: (id) =>
          mutate((state) => ({
            edges: state.edges.map((edge) =>
              edge.id === id
                ? {
                    ...edge,
                    source: edge.target,
                    target: edge.source,
                    data: edge.data
                      ? { ...edge.data, waypoints: [...edge.data.waypoints].reverse() }
                      : undefined,
                  }
                : edge,
            ),
          })),

        setEdgeWaypoints: (id, waypoints) =>
          set((state) => ({
            edges: state.edges.map((edge) =>
              edge.id === id && edge.data
                ? { ...edge, data: { ...edge.data, waypoints } }
                : edge,
            ),
          })),

        deleteSelection: () =>
          mutate((state) => {
            const doomed = new Set(
              state.nodes.filter((node) => node.selected).map((node) => node.id),
            )
            const selectedEdges = new Set(
              state.edges.filter((edge) => edge.selected).map((edge) => edge.id),
            )
            if (doomed.size === 0 && selectedEdges.size === 0) return null
            return {
              nodes: state.nodes.filter((node) => !doomed.has(node.id)),
              edges: state.edges.filter(
                (edge) =>
                  !selectedEdges.has(edge.id) &&
                  !doomed.has(edge.source) &&
                  !doomed.has(edge.target),
              ),
            }
          }),

        duplicateSelection: () => {
          get().copySelection()
          get().paste()
        },

        copySelection: () => {
          const state = get()
          const nodes = state.nodes.filter((node) => node.selected)
          if (nodes.length === 0) return
          const ids = new Set(nodes.map((node) => node.id))
          set({
            clipboard: {
              nodes: nodes.map((node) => ({ ...node, data: { ...node.data } })),
              // Only edges fully inside the selection survive a copy.
              edges: state.edges
                .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
                .map((edge) => ({
                  ...edge,
                  data: edge.data ? { ...edge.data, waypoints: [] } : undefined,
                })),
            },
          })
        },

        paste: () =>
          mutate((state) => {
            const clipboard = state.clipboard
            if (!clipboard || clipboard.nodes.length === 0) return null

            const idMap = new Map<string, string>()
            const nodes = clipboard.nodes.map((node) => {
              const id = nextId(nodeKindOf(node))
              idMap.set(node.id, id)
              return {
                ...node,
                id,
                position: {
                  x: node.position.x + PASTE_OFFSET,
                  y: node.position.y + PASTE_OFFSET,
                },
                data: { ...node.data },
                selected: true,
              }
            })
            const edges = clipboard.edges.flatMap((edge) => {
              const source = idMap.get(edge.source)
              const target = idMap.get(edge.target)
              if (!source || !target) return []
              return [
                {
                  ...edge,
                  id: nextId(edgeKindOf(edge)),
                  source,
                  target,
                  selected: false,
                  data: edge.data ? { ...edge.data, waypoints: [] } : undefined,
                },
              ]
            })

            return {
              nodes: [
                ...state.nodes.map((node) =>
                  node.selected ? { ...node, selected: false } : node,
                ),
                ...nodes,
              ],
              edges: [...state.edges, ...edges],
              // Paste again to stack further copies down-right.
              clipboard: { nodes, edges },
            }
          }),

        selectAll: () =>
          set((state) => ({
            nodes: state.nodes.map((node) =>
              node.selected ? node : { ...node, selected: true },
            ),
            edges: state.edges.map((edge) =>
              edge.selected ? edge : { ...edge, selected: true },
            ),
          })),

        selectOnly: (ids) => {
          const wanted = new Set(ids)
          set((state) => ({
            nodes: withSelection(state.nodes, wanted),
            edges: withSelection(state.edges, wanted),
          }))
        },

        clearSelection: () => get().selectOnly([]),

        align: (axis) =>
          mutate((state) => {
            const selected = state.nodes.filter((node) => node.selected)
            if (selected.length < 2) return null
            const positions = alignPositions(selected, axis)
            return {
              nodes: state.nodes.map((node) => {
                const position = positions.get(node.id)
                return position ? { ...node, position } : node
              }),
            }
          }),

        distribute: (axis) =>
          mutate((state) => {
            const selected = state.nodes.filter((node) => node.selected)
            if (selected.length < 3) return null
            const positions = distributePositions(selected, axis)
            return {
              nodes: state.nodes.map((node) => {
                const position = positions.get(node.id)
                return position
                  ? { ...node, position: { x: snap(position.x), y: snap(position.y) } }
                  : node
              }),
            }
          }),

        bringToFront: (ids) =>
          mutate((state) => {
            const target = new Set(ids)
            const top = Math.max(0, ...state.nodes.map((node) => node.data.z)) + 1
            return {
              nodes: state.nodes.map((node) =>
                target.has(node.id)
                  ? { ...node, zIndex: top, data: { ...node.data, z: top } }
                  : node,
              ),
            }
          }),

        sendToBack: (ids) =>
          mutate((state) => {
            const target = new Set(ids)
            const bottom = Math.min(0, ...state.nodes.map((node) => node.data.z)) - 1
            return {
              nodes: state.nodes.map((node) =>
                target.has(node.id)
                  ? { ...node, zIndex: bottom, data: { ...node.data, z: bottom } }
                  : node,
              ),
            }
          }),

        setMeta: (patch) =>
          set((state) => ({ meta: { ...state.meta, ...patch } })),

        setUi: (patch) => set((state) => ({ ui: { ...state.ui, ...patch } })),

        toggleGuideStep: (stepId) =>
          set((state) => ({
            ui: {
              ...state.ui,
              guideChecks: {
                ...state.ui.guideChecks,
                [stepId]: !state.ui.guideChecks[stepId],
              },
            },
          })),

        setFlagged: (ids) =>
          set((state) => ({ ui: { ...state.ui, flagged: ids } })),

        loadDocument: (doc) => {
          const state = get()
          set({
            nodes: doc.nodes,
            edges: doc.edges,
            meta: doc.meta,
            ...pushHistory(state, takeSnapshot(state)),
          })
        },

        resetDocument: () => {
          const state = get()
          set({
            nodes: [],
            edges: [],
            meta: INITIAL_META,
            ...pushHistory(state, takeSnapshot(state)),
          })
        },

        toDocument: () => {
          const state = get()
          return {
            version: 1,
            meta: state.meta,
            nodes: state.nodes.map((node) => ({ ...node, selected: false })),
            edges: state.edges.map((edge) => ({ ...edge, selected: false })),
          }
        },
      }
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => createDebouncedStorage(AUTOSAVE_DELAY_MS)),
      // History, clipboard and transient highlights are per-session.
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        meta: state.meta,
        ui: {
          ...state.ui,
          flagged: [],
          editingId: null,
        },
      }),
    },
  ),
)
