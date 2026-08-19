import { create } from 'zustand'
import { probeConnection } from '../llm/client'
import {
  EMPTY_LLM_CONFIG,
  isLlmConfigured,
  trimConfig,
  type LlmConfig,
} from '../llm/types'

/**
 * The connection lives in `localStorage`, next to the theme and the document.
 * That includes the key: the app has no backend, so the browser is the only
 * place it could live, and the calls go straight from the browser to the URL
 * the user typed. It is the right trade for your own endpoint and the wrong
 * one for a key you would not paste into a shared machine.
 */
const STORAGE_KEY = 'ohmydiagrams:llm:v1'

export type LlmProbe = 'idle' | 'testing' | 'ok' | 'error'

function load(): LlmConfig {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return EMPTY_LLM_CONFIG
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_LLM_CONFIG
    const candidate = parsed as Partial<Record<keyof LlmConfig, unknown>>
    return trimConfig({
      baseUrl: typeof candidate.baseUrl === 'string' ? candidate.baseUrl : '',
      apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : '',
      model: typeof candidate.model === 'string' ? candidate.model : '',
    })
  } catch {
    return EMPTY_LLM_CONFIG
  }
}

interface LlmState {
  config: LlmConfig
  /** Result of the last "probar conexión", shown in the settings dialog. */
  probe: LlmProbe
  probeError: string | null
  configured: boolean
  save: (config: LlmConfig) => void
  clear: () => void
  test: (config: LlmConfig) => Promise<boolean>
}

const initial = load()

export const useLlm = create<LlmState>((set) => ({
  config: initial,
  probe: 'idle',
  probeError: null,
  configured: isLlmConfigured(initial),

  save: (config) => {
    const next = trimConfig(config)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    set({ config: next, configured: isLlmConfigured(next) })
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({
      config: EMPTY_LLM_CONFIG,
      configured: false,
      probe: 'idle',
      probeError: null,
    })
  },

  test: async (config) => {
    const next = trimConfig(config)
    if (!isLlmConfigured(next)) {
      set({ probe: 'error', probeError: 'Faltan la URL o el modelo.' })
      return false
    }
    set({ probe: 'testing', probeError: null })
    const result = await probeConnection(next)
    set(
      result.ok
        ? { probe: 'ok', probeError: null }
        : { probe: 'error', probeError: result.error },
    )
    return result.ok
  },
}))
