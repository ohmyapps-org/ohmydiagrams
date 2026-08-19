import type { LlmConfig, Result } from './types'

const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Turns whatever the user pasted into the chat-completions endpoint.
 *
 * People paste three things: the bare host (`http://vps:11434`), the versioned
 * base (`https://api.openai.com/v1`) or the full route copied from the docs.
 * All three have to work, because the alternative is a settings dialog that
 * rejects a URL the server would have accepted.
 */
export function chatEndpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (base.endsWith('/chat/completions')) return base
  // `/v1` (OpenAI, xAI, most self-hosted servers) and `/openai` (Google's
  // Gemini compatibility layer) both mark a base that already ends at its
  // version segment: just append the route, don't insert another `/v1`.
  if (/\/(v\d+|openai)$/.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

function headers(config: LlmConfig): HeadersInit {
  const value: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) value.Authorization = `Bearer ${config.apiKey}`
  return value
}

/** Whatever the server said, cut down to something readable in a toast. */
function bodyError(status: number, body: string): string {
  let detail = body.slice(0, 300)
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      const error = (parsed as { error?: unknown }).error
      const message =
        typeof error === 'string'
          ? error
          : typeof error === 'object' && error !== null
            ? (error as { message?: unknown }).message
            : (parsed as { message?: unknown }).message
      if (typeof message === 'string' && message) detail = message
    }
  } catch {
    // Not JSON: the raw slice is still the best thing we have.
  }

  switch (status) {
    case 401:
    case 403:
      return `El servidor rechazó la clave (${status}). ${detail}`
    case 404:
      return `No existe esa ruta o ese modelo (404). Revisá la URL y el nombre del modelo. ${detail}`
    case 429:
      return `El servidor pidió esperar (429). ${detail}`
    default:
      return `El modelo respondió ${status}. ${detail}`
  }
}

function contentOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const message = (choices[0] as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return null
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content : null
}

export interface ChatRequest {
  system: string
  user: string
  /** Zero by default: the same document should read the same way twice. */
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  signal?: AbortSignal
}

/** One non-streaming chat completion. Never throws; failures come back as values. */
export async function chat(
  config: LlmConfig,
  request: ChatRequest,
): Promise<Result<string>> {
  const timeout = AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = request.signal
    ? AbortSignal.any([request.signal, timeout])
    : timeout

  let response: Response
  try {
    response = await fetch(chatEndpoint(config.baseUrl), {
      method: 'POST',
      headers: headers(config),
      signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        temperature: request.temperature ?? 0,
        max_tokens: request.maxTokens ?? 2048,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
      }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { ok: false, error: 'El modelo tardó demasiado en responder.' }
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'Consulta cancelada.' }
    }
    // The browser hides the reason on purpose, and it is almost always one of
    // these two, so name both instead of repeating "Failed to fetch".
    return {
      ok: false,
      error:
        'No se pudo contactar al servidor. Revisá la URL y que permita CORS desde este origen.',
    }
  }

  if (!response.ok) {
    return { ok: false, error: bodyError(response.status, await response.text()) }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, error: 'El servidor no devolvió JSON.' }
  }

  const content = contentOf(payload)
  if (content === null) {
    return { ok: false, error: 'La respuesta no trae ningún mensaje.' }
  }
  return { ok: true, value: content }
}

/**
 * Round trip with the smallest possible completion. It exercises URL, key and
 * model name together, which is what the settings dialog needs to confirm.
 */
export async function probeConnection(config: LlmConfig): Promise<Result<string>> {
  const result = await chat(config, {
    system: 'Respondé con la palabra ok.',
    user: 'ok',
    maxTokens: 16,
    timeoutMs: 20_000,
  })
  if (!result.ok) return result
  return { ok: true, value: config.model }
}
