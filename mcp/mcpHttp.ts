import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { CanvasBridge } from './bridge'
import { publicOrigin, verifyAccessToken } from './oauth'
import { registerTools } from './tools'

/**
 * Streamable HTTP MCP transport for `/mcp`, for remote connectors (Claude.ai,
 * ChatGPT, Gemini, Grok) that reach this server over the public internet
 * instead of spawning it locally over stdio.
 *
 * Each MCP session gets its own `McpServer`: the SDK's `Protocol.connect`
 * claims exclusive ownership of a transport, so a session boundary is also a
 * server-instance boundary. All sessions share the same `CanvasBridge`
 * (`registerTools(server, bridge)`), which is the same bridge the local
 * stdio server and the loopback WebSocket relay use — whichever diagram is
 * open in the connected browser tab is what every session controls.
 */

interface Session {
  server: McpServer
  transport: WebStandardStreamableHTTPServerTransport
}

const sessions = new Map<string, Session>()

function unauthorized(origin: string): Response {
  const resourceMetadataUrl = `${origin}/.well-known/oauth-protected-resource/mcp`
  return new Response(JSON.stringify({ error: 'invalid_token' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${resourceMetadataUrl}"`,
    },
  })
}

export async function handleMcpRequest(request: Request, bridge: CanvasBridge): Promise<Response> {
  const origin = publicOrigin(request)
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  if (!token || !verifyAccessToken(token)) return unauthorized(origin)

  const sessionId = request.headers.get('mcp-session-id')
  if (sessionId) {
    const session = sessions.get(sessionId)
    if (!session) return new Response('Sesión desconocida.', { status: 404 })
    return session.transport.handleRequest(request)
  }

  // No session header: this must be an `initialize` call starting a new session.
  const server = new McpServer({ name: 'ohmydiagrams', version: '0.1.0' })
  registerTools(server, bridge)
  let transport!: WebStandardStreamableHTTPServerTransport
  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: (id) => {
      sessions.set(id, { server, transport })
    },
    onsessionclosed: (id) => {
      sessions.delete(id)
    },
  })
  await server.connect(transport)
  return transport.handleRequest(request)
}
