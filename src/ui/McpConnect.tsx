import { AlertCircle, Check, Copy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '../store/toasts'
import Bloub from './agent/Bloub'
import type { AgentMood } from './agent/pose'
import Skeleton from './Skeleton'

interface Platform {
  name: string
  vendor: string
  logo: string
  invertLogo?: boolean
  steps: string
}

const PLATFORMS: readonly Platform[] = [
  { name: 'Claude', vendor: 'Anthropic', logo: '/claude-color.webp', steps: 'Configuración → Conectores → Agregar' },
  { name: 'GPT', vendor: 'OpenAI', logo: '/openai.webp', invertLogo: true, steps: 'Configuración → Apps → Avanzado → Modo desarrollador' },
  { name: 'Gemini', vendor: 'Google', logo: '/gemini-color.webp', steps: 'Conector MCP personalizado' },
  { name: 'Grok', vendor: 'xAI', logo: '/grok.webp', steps: 'grok.com/connectors → Nuevo conector → Personalizado' },
]

type Status = 'checking' | 'ready' | 'unavailable'

/**
 * GET on the resource-metadata endpoint tells us if the server side of this
 * is actually configured, without needing the owner's token. A status code
 * alone isn't proof: a static-hosting SPA fallback (`try_files → index.html`,
 * which is also how the Vite dev server behaves) answers 200 on literally
 * any path, so this checks the body is really the JSON metadata document.
 */
function useConnectorStatus(url: string): Status {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    let cancelled = false
    setStatus('checking')
    fetch(`${new URL(url).origin}/.well-known/oauth-protected-resource/mcp`)
      .then(async (response) => {
        if (!response.ok) return false
        const body: unknown = await response.json()
        return (
          typeof body === 'object' &&
          body !== null &&
          typeof (body as { resource?: unknown }).resource === 'string'
        )
      })
      .then((ok) => {
        if (!cancelled) setStatus(ok ? 'ready' : 'unavailable')
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return status
}

/** The face mirrors the probe: still looking, found it, or nothing there. */
const PROBE_MOOD: Record<Status, AgentMood> = {
  checking: 'scan',
  ready: 'ok',
  unavailable: 'error',
}

function StatusLine({ status }: { status: Status }) {
  if (status === 'checking') {
    return (
      <div role="status" aria-busy="true" aria-label="Revisando este servidor">
        <Skeleton className="h-2.5 w-48" />
      </div>
    )
  }
  if (status === 'ready') {
    return (
      <p className="flex items-center gap-1.5 text-[11.5px] text-ok">
        <Check size={12} />
        El conector está activo en este servidor.
      </p>
    )
  }
  // Not a flex row: the sentence wraps around inline code, and every bare text
  // node in a flex container would become its own column.
  return (
    <p className="text-[11.5px] leading-snug text-warn">
      <AlertCircle size={12} className="mr-1 inline-block align-[-2px]" />
      Este servidor todavía no tiene el conector configurado (falta{' '}
      <code className="text-[10.5px]">OHMYDIAGRAMS_OWNER_TOKEN</code> en el
      despliegue). La URL de abajo no va a funcionar hasta entonces.
    </p>
  )
}

/**
 * The primary way to connect an AI platform: this canvas as a remote MCP
 * server, added by URL in Claude / ChatGPT / Gemini / Grok's own settings.
 * The dialog only ever shows the URL — the owner's passphrase is typed once
 * on the platform's side, in the consent page this server renders at
 * `/authorize`, never inside this app.
 */
export default function McpConnect({ onClose }: { onClose: () => void }) {
  const mcpUrl = `${window.location.origin}/mcp`
  const status = useConnectorStatus(mcpUrl)

  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])

  const copy = (): void => {
    void navigator.clipboard.writeText(mcpUrl)
    toast.success('URL copiada.')
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conectar tu plataforma de IA"
        className="glass w-[26rem] max-w-full rounded-panel p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <Bloub size={34} mood={PROBE_MOOD[status]} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[13.5px] font-semibold text-ink">Conectar tu plataforma de IA</h2>
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
              Pegá esta URL en los conectores de Claude, ChatGPT, Gemini o Grok. Vas a autorizar
              la conexión una sola vez, del lado de la plataforma.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-6 w-6 shrink-0 rounded-control text-faint transition hover:bg-accent-soft hover:text-ink"
          >
            <X size={13} className="mx-auto" />
          </button>
        </div>

        <div className="mb-1 flex items-center gap-1.5">
          <input
            readOnly
            value={mcpUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-control border border-line bg-surface/60 px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={copy}
            aria-label="Copiar URL"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line-strong text-ink transition hover:border-accent hover:text-accent"
          >
            <Copy size={13} />
          </button>
        </div>

        <div className="mb-3 min-h-[16px]">
          <StatusLine status={status} />
        </div>

        <div className="mb-1 space-y-1.5">
          {PLATFORMS.map((platform) => (
            <div key={platform.name} className="flex items-center gap-2.5 rounded-control border border-line px-2.5 py-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-line bg-white p-0.5">
                <img
                  src={platform.logo}
                  alt=""
                  className={`h-full w-full object-contain ${platform.invertLogo ? 'invert' : ''}`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-[12.5px] font-medium text-ink">{platform.name}</span>
                <span className="ml-1.5 text-[11px] text-faint">{platform.vendor}</span>
                <span className="block truncate text-[11px] text-muted">{platform.steps}</span>
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-snug text-faint">
          La plataforma controla el diagrama que tengas abierto en este navegador, igual que el
          agente MCP local. No hace falta correr nada en tu máquina.
        </p>
      </div>
    </div>,
    document.body,
  )
}
