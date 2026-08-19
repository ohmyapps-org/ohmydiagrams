import { AlertCircle, Check, ChevronDown, Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { chatEndpoint } from '../llm/client'
import { isLlmConfigured, type LlmConfig } from '../llm/types'
import { useLlm } from '../store/llm'
import { toast } from '../store/toasts'

const inputClass =
  'w-full rounded-control border border-line bg-surface/60 px-2 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent'

interface Provider {
  id: string
  name: string
  vendor: string
  /** Path under `public/`. */
  logo: string
  /** The OpenAI mark ships as a white silhouette; flip it for a light badge. */
  invertLogo?: boolean
  baseUrl: string
  model: string
  keyPlaceholder: string
  keySource: string
}

/**
 * The four hosted providers people actually ask for by name. One click sets
 * the base URL and a sensible model; all that's left to paste is the key.
 * Every one of these speaks the OpenAI chat-completions dialect already,
 * either natively (OpenAI) or through a documented compatibility layer
 * (Anthropic, Google, xAI) — the same `chat()` call handles all four.
 */
const PROVIDERS: readonly Provider[] = [
  {
    id: 'anthropic',
    name: 'Claude',
    vendor: 'Anthropic',
    logo: '/claude-color.webp',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5',
    keyPlaceholder: 'sk-ant-…',
    keySource: 'console.anthropic.com',
  },
  {
    id: 'openai',
    name: 'GPT',
    vendor: 'OpenAI',
    logo: '/openai.webp',
    invertLogo: true,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5-mini',
    keyPlaceholder: 'sk-…',
    keySource: 'platform.openai.com',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    vendor: 'Google',
    logo: '/gemini-color.webp',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza…',
    keySource: 'aistudio.google.com',
  },
  {
    id: 'grok',
    name: 'Grok',
    vendor: 'xAI',
    logo: '/grok.webp',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4-fast',
    keyPlaceholder: 'xai-…',
    keySource: 'console.x.ai',
  },
]

function findProvider(baseUrl: string): Provider | undefined {
  const trimmed = baseUrl.trim()
  return PROVIDERS.find((provider) => provider.baseUrl === trimmed)
}

/** Endpoints for a server you run yourself: local, or on your own VPS. */
const SELF_HOST_EXAMPLES: readonly { label: string; url: string; model: string }[] = [
  { label: 'Ollama', url: 'http://localhost:11434/v1', model: 'llama3.1' },
  { label: 'vLLM / LM Studio', url: 'http://tu-vps:8000/v1', model: 'mistral-7b-instruct' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
]

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-faint">{hint}</span>}
    </label>
  )
}

function ProbeLine() {
  const probe = useLlm((state) => state.probe)
  const error = useLlm((state) => state.probeError)

  if (probe === 'idle') return null
  if (probe === 'testing') {
    return (
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <Loader2 size={12} className="animate-spin" />
        Probando…
      </p>
    )
  }
  if (probe === 'ok') {
    return (
      <p className="flex items-center gap-1.5 text-[11.5px] text-ok">
        <Check size={12} />
        El modelo respondió.
      </p>
    )
  }
  return (
    <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-danger">
      <AlertCircle size={12} className="mt-0.5 shrink-0" />
      {error}
    </p>
  )
}

/**
 * Connection to a chat model, as a URL. The app never assumes a provider: what
 * is stored is an OpenAI-compatible base URL, an optional key and a model
 * name, so a container on a VPS and a hosted API are the same case.
 */
export default function LlmSettings({ onClose }: { onClose: () => void }) {
  const stored = useLlm((state) => state.config)
  const save = useLlm((state) => state.save)
  const clear = useLlm((state) => state.clear)
  const test = useLlm((state) => state.test)
  const probe = useLlm((state) => state.probe)

  const [form, setForm] = useState<LlmConfig>(stored)
  /** Starts open only for a base URL that isn't one of the four buttons. */
  const [advancedOpen, setAdvancedOpen] = useState(
    () => stored.baseUrl.trim().length > 0 && !findProvider(stored.baseUrl),
  )

  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])

  const edit = (patch: Partial<LlmConfig>): void =>
    setForm((value) => ({ ...value, ...patch }))

  const active = advancedOpen ? undefined : findProvider(form.baseUrl)

  const selectProvider = (provider: Provider): void => {
    edit({ baseUrl: provider.baseUrl, model: provider.model })
    setAdvancedOpen(false)
  }

  const confirm = (): void => {
    save(form)
    toast.success(
      isLlmConfigured(form)
        ? 'Modelo conectado. La lectura de requisitos lo va a usar.'
        : 'Conexión vacía: la lectura vuelve a ser local.',
    )
    onClose()
  }

  const forget = (): void => {
    clear()
    setForm({ baseUrl: '', apiKey: '', model: '' })
    toast.info('Conexión borrada. La lectura vuelve a ser local.')
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
        aria-label="Conexión con el modelo"
        className="glass w-[26rem] max-w-full rounded-panel p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[13.5px] font-semibold text-ink">Conectar un modelo</h2>
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
              Cualquier servidor con API compatible con OpenAI. Se usa para leer la
              especificación de requisitos.
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

        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-faint">
          Conectar con un proveedor
        </span>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {PROVIDERS.map((provider) => {
            const selected = active?.id === provider.id
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => selectProvider(provider)}
                aria-pressed={selected}
                className={`flex items-center gap-2 rounded-control border px-2.5 py-2 text-left transition ${
                  selected
                    ? 'border-accent bg-accent-soft'
                    : 'border-line hover:border-accent/60 hover:bg-accent-soft/50'
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-line bg-white p-1">
                  <img
                    src={provider.logo}
                    alt=""
                    className={`h-full w-full object-contain ${provider.invertLogo ? 'invert' : ''}`}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {provider.name}
                  </span>
                  <span className="block truncate text-[11px] text-faint">{provider.vendor}</span>
                </span>
              </button>
            )
          })}
        </div>

        {active && (
          <p className="-mt-2 mb-3 text-[11px] leading-snug text-faint">
            POST {chatEndpoint(form.baseUrl)}
          </p>
        )}

        <Field label="Modelo">
          <input
            value={form.model}
            onChange={(event) => edit({ model: event.target.value })}
            placeholder={active?.model ?? 'llama3.1'}
            spellCheck={false}
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <Field
          label="Clave de API"
          hint={
            active
              ? `Se obtiene en ${active.keySource}. Queda en este navegador, en localStorage.`
              : 'Queda en este navegador, en localStorage. Un servidor propio sin autenticación no la necesita.'
          }
        >
          <input
            type="password"
            value={form.apiKey}
            onChange={(event) => edit({ apiKey: event.target.value })}
            placeholder={active?.keyPlaceholder ?? 'sk-…'}
            spellCheck={false}
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          aria-expanded={advancedOpen}
          className="mb-3 flex items-center gap-1 text-[11.5px] font-medium text-muted transition hover:text-ink"
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
          Avanzado: servidor propio o VPS
        </button>

        {advancedOpen && (
          <>
            <Field
              label="URL base"
              hint={form.baseUrl.trim() ? `POST ${chatEndpoint(form.baseUrl)}` : undefined}
            >
              <input
                value={form.baseUrl}
                onChange={(event) => edit({ baseUrl: event.target.value })}
                placeholder="https://mi-vps.com/v1"
                spellCheck={false}
                autoComplete="off"
                className={inputClass}
              />
            </Field>

            <div className="mb-3 flex flex-wrap gap-1">
              {SELF_HOST_EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => edit({ baseUrl: example.url, model: example.model })}
                  className="rounded-control border border-line px-1.5 py-0.5 text-[11px] text-muted transition hover:border-accent hover:text-accent"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mb-3 text-[11px] leading-snug text-faint">
          El texto de la especificación se envía a esa URL. El diagrama no sale del
          navegador. Si el servidor está en otro dominio, tiene que permitir CORS
          desde este origen.
        </p>

        <div className="mb-2 min-h-[16px]">
          <ProbeLine />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void test(form)}
            disabled={probe === 'testing'}
            className="rounded-control border border-line-strong px-2.5 py-1.5 text-[12px] font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Probar conexión
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-control bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:opacity-90"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={forget}
            className="ml-auto rounded-control px-2 py-1.5 text-[12px] text-muted transition hover:text-danger"
          >
            Borrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
