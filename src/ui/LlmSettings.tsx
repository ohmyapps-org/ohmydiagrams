import { AlertCircle, Check, Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { chatEndpoint } from '../llm/client'
import { isLlmConfigured, type LlmConfig } from '../llm/types'
import { useLlm } from '../store/llm'
import { toast } from '../store/toasts'

const inputClass =
  'w-full rounded-control border border-line bg-surface/60 px-2 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent'

/** Endpoints people actually paste, as a reminder of the expected shape. */
const EXAMPLES: readonly { label: string; url: string; model: string }[] = [
  { label: 'Ollama', url: 'http://localhost:11434/v1', model: 'llama3.1' },
  { label: 'vLLM / LM Studio', url: 'http://tu-vps:8000/v1', model: 'mistral-7b-instruct' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'Anthropic', url: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5' },
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

  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])

  const edit = (patch: Partial<LlmConfig>): void =>
    setForm((value) => ({ ...value, ...patch }))

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

        <Field label="Modelo">
          <input
            value={form.model}
            onChange={(event) => edit({ model: event.target.value })}
            placeholder="llama3.1"
            spellCheck={false}
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <Field
          label="Clave (opcional)"
          hint="Queda en este navegador, en localStorage. Un servidor propio sin autenticación no la necesita."
        >
          <input
            type="password"
            value={form.apiKey}
            onChange={(event) => edit({ apiKey: event.target.value })}
            placeholder="sk-…"
            spellCheck={false}
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <div className="mb-3 flex flex-wrap gap-1">
          {EXAMPLES.map((example) => (
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
