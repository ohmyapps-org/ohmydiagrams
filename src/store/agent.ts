import { create } from 'zustand'
import type { BridgeMethod } from '../bridge/protocol'

/**
 * Tool calls land and finish inside a single tick, so "busy" is held open for a
 * short tail after the last one. Without it the indicator would flicker on and
 * off inside one frame and never actually be seen.
 */
const BUSY_TAIL_MS = 900
/** Enough history to read the shape of what an agent just did. */
const MAX_EVENTS = 6

export type AgentEventStatus = 'ok' | 'error'

export interface AgentEvent {
  id: string
  method: BridgeMethod
  /** What the call did, in the words the diagram uses. */
  label: string
  status: AgentEventStatus
  at: number
}

/** Spanish label per method, so the feed reads as actions and not as an API. */
const LABELS: Record<BridgeMethod, string> = {
  getDiagram: 'Leyendo el diagrama',
  getValidation: 'Revisando las reglas',
  addNode: 'Agregando un elemento',
  addEdge: 'Conectando dos elementos',
  updateNode: 'Editando un elemento',
  deleteElements: 'Borrando elementos',
  setMeta: 'Cambiando el título',
  insertSkeleton: 'Insertando un esqueleto',
  loadDocument: 'Cargando un diagrama',
  clear: 'Vaciando el lienzo',
}

interface AgentState {
  /** True while a call is in flight, plus a short tail so it can be seen. */
  busy: boolean
  /** Newest first, capped at `MAX_EVENTS`. */
  events: AgentEvent[]
  /** Calls handled since the canvas connected. */
  total: number
  record: (method: BridgeMethod, status: AgentEventStatus) => void
  reset: () => void
}

let tailTimer: ReturnType<typeof setTimeout> | null = null
let counter = 0

export const useAgentActivity = create<AgentState>((set) => ({
  busy: false,
  events: [],
  total: 0,

  record: (method, status) => {
    counter += 1
    const event: AgentEvent = {
      id: `call-${counter}`,
      method,
      label: LABELS[method],
      status,
      at: Date.now(),
    }
    set((state) => ({
      busy: true,
      total: state.total + 1,
      events: [event, ...state.events].slice(0, MAX_EVENTS),
    }))

    if (tailTimer !== null) clearTimeout(tailTimer)
    tailTimer = setTimeout(() => {
      tailTimer = null
      set({ busy: false })
    }, BUSY_TAIL_MS)
  },

  reset: () => {
    if (tailTimer !== null) {
      clearTimeout(tailTimer)
      tailTimer = null
    }
    set({ busy: false, events: [], total: 0 })
  },
}))
