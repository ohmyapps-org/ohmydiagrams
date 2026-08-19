#!/usr/bin/env bun
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { BRIDGE_PORT } from '../src/bridge/protocol'
import { CanvasBridge } from './bridge'
import { mcpAuthEnabled } from './oauth'
import { registerTools } from './tools'

/**
 * MCP server for Oh My Diagrams.
 *
 * stdout belongs to the MCP transport, so every diagnostic goes to stderr.
 */
const port = Number(process.env.OHMYDIAGRAMS_BRIDGE_PORT ?? BRIDGE_PORT)

const bridge = new CanvasBridge()
bridge.listen(port)
console.error(`[ohmydiagrams] esperando al lienzo en ws://127.0.0.1:${port}`)

if (mcpAuthEnabled()) {
  const host = process.env.OHMYDIAGRAMS_BRIDGE_HOST?.trim() || '127.0.0.1'
  console.error(
    `[ohmydiagrams] conector remoto activo: http://${host}:${port}/mcp (proxeá esto detrás de HTTPS para exponerlo)`,
  )
} else {
  console.error(
    '[ohmydiagrams] conector remoto desactivado: definí OHMYDIAGRAMS_OWNER_TOKEN para habilitar /mcp y OAuth.',
  )
}

const server = new McpServer({
  name: 'ohmydiagrams',
  version: '0.1.0',
})

registerTools(server, bridge)

await server.connect(new StdioServerTransport())
