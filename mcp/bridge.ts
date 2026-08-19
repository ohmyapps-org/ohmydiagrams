import type { ServerWebSocket } from 'bun'
import {
  BRIDGE_PATH,
  BRIDGE_PORT,
  type BridgeMethod,
  type BridgeParams,
  type BridgeResult,
  type BridgeRequest,
} from '../src/bridge/protocol'
import { handleMcpRequest } from './mcpHttp'
import { handleOAuthRoute, mcpAuthEnabled } from './oauth'

const CALL_TIMEOUT_MS = 10_000

interface Pending {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class BridgeDisconnected extends Error {
  constructor() {
    super(
      'El lienzo no está conectado. Abrí Oh My Diagrams y activá el botón del enchufe en la barra superior.',
    )
    this.name = 'BridgeDisconnected'
  }
}

/**
 * Hosts the local socket the canvas connects back to. The browser is the only
 * place the document lives, so every tool call is a round trip: this class
 * owns nothing but the correlation between a request and its answer.
 */
export class CanvasBridge {
  private socket: ServerWebSocket<unknown> | null = null
  private readonly pending = new Map<string, Pending>()
  private counter = 0

  get connected(): boolean {
    return this.socket !== null
  }

  listen(port: number = BRIDGE_PORT): void {
    Bun.serve({
      // Loopback by default: nothing outside this machine may touch the
      // canvas. Set OHMYDIAGRAMS_BRIDGE_HOST (e.g. to a VPS deploy's
      // "0.0.0.0" behind a reverse proxy) to expose it — that's also the
      // only way the OAuth/`/mcp` surface below becomes reachable at all.
      hostname: process.env.OHMYDIAGRAMS_BRIDGE_HOST?.trim() || '127.0.0.1',
      port,
      fetch: async (request, server) => {
        const pathname = new URL(request.url).pathname

        if (pathname === BRIDGE_PATH) {
          return server.upgrade(request)
            ? undefined
            : new Response('Expected a WebSocket upgrade', { status: 426 })
        }

        if (mcpAuthEnabled()) {
          const oauthResponse = await handleOAuthRoute(request)
          if (oauthResponse) return oauthResponse
          if (pathname === '/mcp') return handleMcpRequest(request, this)
        }

        return new Response('Not found', { status: 404 })
      },
      websocket: {
        open: (socket) => {
          this.socket = socket
        },
        close: (socket) => {
          if (this.socket === socket) this.socket = null
          this.failAll('El lienzo se desconectó mientras se ejecutaba la llamada.')
        },
        message: (_socket, raw) => this.receive(String(raw)),
      },
    })
  }

  call<M extends BridgeMethod>(
    method: M,
    params: BridgeParams<M>,
  ): Promise<BridgeResult<M>> {
    const socket = this.socket
    if (!socket) return Promise.reject(new BridgeDisconnected())

    this.counter += 1
    const id = `call-${this.counter}`
    const request: BridgeRequest<M> = { type: 'request', id, method, params }

    return new Promise<BridgeResult<M>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('El lienzo no respondió a tiempo.'))
      }, CALL_TIMEOUT_MS)

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      })
      socket.send(JSON.stringify(request))
    })
  }

  private receive(raw: string): void {
    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return
    }
    if (typeof payload !== 'object' || payload === null) return

    const message = payload as { type?: string; id?: string; ok?: boolean; result?: unknown; error?: string }
    if (message.type !== 'response' || typeof message.id !== 'string') return

    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    clearTimeout(pending.timer)

    if (message.ok) pending.resolve(message.result)
    else pending.reject(new Error(message.error ?? 'El lienzo rechazó la llamada.'))
  }

  private failAll(reason: string): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason))
    }
    this.pending.clear()
  }
}
