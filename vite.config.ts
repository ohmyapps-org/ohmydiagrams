import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'

/**
 * In a deploy the canvas and the connector share one origin behind a reverse
 * proxy. Dev has two servers: Vite serves the app and `bun run mcp` serves the
 * connector on the bridge port. Without this the SPA fallback answers the
 * connector's own endpoints with index.html, so the connect dialog reads the
 * server as unconfigured even when OHMYDIAGRAMS_OWNER_TOKEN is set.
 *
 * The port is BRIDGE_PORT from `src/bridge/protocol.ts`, repeated rather than
 * imported: pulling a module out of `src` into the config makes Vite's native
 * config loader choke on the extensionless imports underneath it.
 */
const bridge = `http://127.0.0.1:${process.env.OHMYDIAGRAMS_BRIDGE_PORT ?? 7823}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  // pdf.js loads its worker with `type: 'module'`, so the chunk Vite emits for
  // it has to be an ES module rather than Vite's default IIFE bundle.
  worker: { format: 'es' },
  server: {
    // Vite does not read PORT on its own. Honouring it lets a harness place
    // this server on a free port; unset, Vite falls back to its own default.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    proxy: {
      '/mcp': bridge,
      '/authorize': bridge,
      '/token': bridge,
      '/register': bridge,
      '/.well-known/oauth-': bridge,
    },
  },
})
