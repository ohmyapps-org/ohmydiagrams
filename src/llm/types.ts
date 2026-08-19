/**
 * Connection to a chat model. The app speaks the OpenAI chat-completions
 * dialect and nothing else, which is the one every server implements: Ollama,
 * vLLM, LM Studio, llama.cpp, OpenRouter, Groq, OpenAI and Anthropic all
 * answer on `POST {baseUrl}/chat/completions`. "Any LLM" means any URL that
 * answers there.
 */
export interface LlmConfig {
  /** Base URL of the API, with or without the `/v1` suffix. */
  baseUrl: string
  /** Sent as `Authorization: Bearer`. Empty for a server that needs no key. */
  apiKey: string
  model: string
}

export const EMPTY_LLM_CONFIG: LlmConfig = { baseUrl: '', apiKey: '', model: '' }

/** A key is optional (local servers ignore it); a URL and a model are not. */
export function isLlmConfigured(config: LlmConfig): boolean {
  return config.baseUrl.trim().length > 0 && config.model.trim().length > 0
}

export function trimConfig(config: LlmConfig): LlmConfig {
  return {
    baseUrl: config.baseUrl.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
  }
}

/** Errors are values here: a failed call is an expected outcome, not a bug. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
