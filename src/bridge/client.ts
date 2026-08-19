import { create } from 'zustand'
import { useAgentActivity } from '../store/agent'
import { useDocument } from '../store/document'
import { toast } from '../store/toasts'
import { runBridgeMethod } from './handlers'
import {
  BRIDGE_PATH,
  BRIDGE_PORT,
  BRIDGE_VERSION,
  isBridgeRequest,
  type BridgeClientMessage,
  type BridgeMethod,
} from './protocol'

const STORAGE_KEY = 'ohmydiagrams:bridge-enabled:v1'
const RETRY_BASE_MS = 1000
const RETRY_CAP_MS = 8000
/** Roughly half a minute of trying before we assume there is no server. */
const MAX_ATTEMPTS = 5

export type BridgeStatus = 'off' | 'connecting' | 'connected'

interface BridgeState {
  status: BridgeStatus
  toggle: () => void
}

let socket: WebSocket | null = null
let retryTimer: number | null = null
let attempts = 0

function send(message: BridgeClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function respond(id: string, method: BridgeMethod, params: unknown): void {
  // Every tool call from any agent — local or remote — funnels through here,
  // so this is the one place the canvas can show what is being done to it.
  const { record } = useAgentActivity.getState()
  try {
    // The cast is safe: the method is already narrowed, and each handler
    // validates its own params.
    const result = runBridgeMethod(method as never, params as never)
    record(method, 'ok')
    send({ type: 'response', id, ok: true, result })
  } catch (error) {
    record(method, 'error')
    send({
      type: 'response',
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Falló la operación.',
    })
  }
}

export const useBridge = create<BridgeState>((set, get) => {
  const scheduleRetry = (): void => {
    if (get().status === 'off' || retryTimer !== null) return
    if (attempts >= MAX_ATTEMPTS) {
      // Every failed attempt logs a browser error, so stop and say why rather
      // than dripping into the console forever.
      disable()
      toast.info('No se encontró el servidor MCP. Ejecutá "bun run mcp" y volvé a activarlo.')
      return
    }
    const delay = Math.min(RETRY_BASE_MS * 2 ** attempts, RETRY_CAP_MS)
    attempts += 1
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      connect()
    }, delay)
  }

  const connect = (): void => {
    if (socket) return
    const next = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}${BRIDGE_PATH}`)
    socket = next

    next.onopen = () => {
      attempts = 0
      set({ status: 'connected' })
      send({
        type: 'hello',
        version: BRIDGE_VERSION,
        title: useDocument.getState().meta.title,
      })
      toast.success('Agente MCP conectado al lienzo.')
    }

    next.onmessage = (event) => {
      let payload: unknown
      try {
        payload = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (!isBridgeRequest(payload)) return
      respond(payload.id, payload.method, payload.params)
    }

    next.onclose = () => {
      socket = null
      if (get().status === 'off') return
      set({ status: 'connecting' })
      scheduleRetry()
    }

    // `onclose` always follows, so failures are handled in one place.
    next.onerror = () => next.close()
  }

  const disable = (): void => {
    localStorage.setItem(STORAGE_KEY, 'off')
    set({ status: 'off' })
    useAgentActivity.getState().reset()
    stop()
  }

  const stop = (): void => {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
    attempts = 0
    const open = socket
    socket = null
    open?.close()
  }

  const enabled = localStorage.getItem(STORAGE_KEY) === 'on'
  if (enabled) queueMicrotask(connect)

  return {
    status: enabled ? 'connecting' : 'off',
    toggle: () => {
      if (get().status === 'off') {
        localStorage.setItem(STORAGE_KEY, 'on')
        set({ status: 'connecting' })
        connect()
        return
      }
      disable()
    },
  }
})
