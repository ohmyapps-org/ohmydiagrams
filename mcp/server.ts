#!/usr/bin/env bun
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { BRIDGE_PORT } from '../src/bridge/protocol'
import { CanvasBridge } from './bridge'
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

const server = new McpServer({
  name: 'ohmydiagrams',
  version: '0.1.0',
})

registerTools(server, bridge)

await server.connect(new StdioServerTransport())
