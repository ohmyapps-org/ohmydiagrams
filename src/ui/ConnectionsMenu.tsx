import { ChevronDown, Globe, Plug } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { useBridge, type BridgeStatus } from '../bridge/client'
import MenuShell from '../canvas/MenuShell'
import { useLlm } from '../store/llm'
import LlmSettings from './LlmSettings'
import McpConnect from './McpConnect'

/** Matches the `w-[19.5rem]` the menu renders at, for right-edge alignment. */
const MENU_WIDTH_PX = 19.5 * 16

const BRIDGE_STATE: Record<BridgeStatus, { label: string; tone: string }> = {
  off: { label: 'Sin conectar', tone: 'text-faint' },
  connecting: { label: 'Buscando…', tone: 'text-warn' },
  connected: { label: 'Conectado', tone: 'text-ok' },
}

function Row({
  icon,
  title,
  state,
  tone,
  description,
  onClick,
}: {
  icon: ReactNode
  title: string
  state: string
  tone: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-2.5 rounded-[6px] px-2.5 py-2 text-left transition hover:bg-accent-soft"
    >
      <span className="mt-0.5 shrink-0 text-faint">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium text-ink">{title}</span>
          <span className={`shrink-0 truncate text-[11px] ${tone}`}>{state}</span>
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">
          {description}
        </span>
      </span>
    </button>
  )
}

/**
 * Ways to connect an AI to this canvas. The primary path is pasting this
 * server's MCP URL into Claude / ChatGPT / Gemini / Grok's own connector
 * settings — no local process, no key to manage here. The local bridge
 * (for Claude Code / Desktop's stdio config) stays a first-class option.
 * BYOK — this app calling out to a model with your own key — is a niche
 * fallback now, so it moves behind "Avanzado" instead of sitting at the top.
 */
export default function ConnectionsMenu() {
  const [open, setOpen] = useState(false)
  const [mcpOpen, setMcpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const status = useBridge((state) => state.status)
  const toggleBridge = useBridge((state) => state.toggle)
  const configured = useLlm((state) => state.configured)

  const bridge = BRIDGE_STATE[status]
  const linked = configured || status !== 'off'
  const anchor = open ? buttonRef.current?.getBoundingClientRect() : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-medium text-ink transition hover:bg-accent-soft"
      >
        <span className="relative flex">
          <Plug size={15} />
          {linked && (
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-ok" />
          )}
        </span>
        Conexiones
        <ChevronDown size={13} className="text-faint" />
      </button>

      {anchor && (
        <MenuShell
          x={anchor.right - MENU_WIDTH_PX}
          y={anchor.bottom + 4}
          width="w-[19.5rem]"
          onClose={() => setOpen(false)}
          anchorRef={buttonRef}
        >
          <Row
            icon={<Globe size={15} />}
            title="Tu plataforma de IA"
            state="Por URL"
            tone="text-faint"
            description="Conectá Claude, ChatGPT, Gemini o Grok pegando la URL de este lienzo en sus conectores."
            onClick={() => {
              setMcpOpen(true)
              setOpen(false)
            }}
          />
          <Row
            icon={<Plug size={15} />}
            title="Agente MCP local"
            state={bridge.label}
            tone={bridge.tone}
            description={
              status === 'off'
                ? 'Abre este lienzo a un agente que corra en tu máquina (bun run mcp).'
                : 'Un agente puede leer y editar este lienzo. Clic para desconectar.'
            }
            onClick={() => {
              toggleBridge()
              setOpen(false)
            }}
          />
          <div className="mt-1 border-t border-line pt-1">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true)
                setOpen(false)
              }}
              className="w-full rounded-[6px] px-2.5 py-1.5 text-left text-[11.5px] text-muted transition hover:bg-accent-soft hover:text-ink"
            >
              Avanzado: conectá tu propia clave (BYOK)
              {configured && <span className="text-ok"> · conectado</span>}
            </button>
          </div>
        </MenuShell>
      )}

      {mcpOpen && <McpConnect onClose={() => setMcpOpen(false)} />}
      {settingsOpen && <LlmSettings onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
