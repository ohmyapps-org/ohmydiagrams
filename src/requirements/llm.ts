import { chat } from '../llm/client'
import type { LlmConfig } from '../llm/types'
import { isInfinitivePhrase, normalizeName } from '../uml/verbs'
import type { RequirementCandidate, RequirementExtractor } from './types'

/**
 * Enough of a specification to cover its functional requirements, and short
 * enough to fit in the context of a small model running on a modest VPS.
 */
const MAX_INPUT_CHARS = 20_000

const SYSTEM_PROMPT = `Sos un analista de sistemas que lee especificaciones de requisitos y propone los casos de uso de un diagrama UML 2.5.

Reglas:
- Un caso de uso por capacidad funcional que el sistema le ofrece a alguien. Ignorá requisitos no funcionales (rendimiento, seguridad, disponibilidad) y detalles de implementación.
- El nombre va en infinitivo + objeto, en español, sin artículos: "Registrar venta", "Consultar stock". Nunca "El sistema registra ventas".
- "actor" es el rol que dispara la capacidad si el texto lo nombra; si no lo nombra, null. Nunca uses "sistema" como actor.
- "source" es la oración del documento de la que sacaste el caso de uso, copiada tal cual.
- Sin duplicados.

Respondé sólo con un array JSON, sin texto alrededor y sin bloques de código:
[{"name": "Registrar venta", "actor": "Vendedor", "source": "El sistema debe permitir registrar ventas."}]
Si el documento no describe ninguna capacidad, respondé [].`

interface RawCandidate {
  name: string
  actor: string | null
  source: string
}

/** Models like to wrap JSON in prose or fences; keep the array and drop the rest. */
function extractArray(content: string): unknown {
  const withoutFences = content.replace(/```(?:json)?/gi, '').trim()
  const start = withoutFences.indexOf('[')
  const end = withoutFences.lastIndexOf(']')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(withoutFences.slice(start, end + 1))
  } catch {
    return null
  }
}

function readRaw(value: unknown): RawCandidate | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (name.length < 3) return null
  const actor = typeof record.actor === 'string' ? record.actor.trim() : ''
  const source = typeof record.source === 'string' ? record.source.trim() : ''
  return { name, actor: actor.length > 0 ? actor : null, source: source || name }
}

const NON_ACTORS = new Set(['sistema', 'system', 'aplicacion', 'aplicación', 'software'])

function toCandidates(parsed: unknown): RequirementCandidate[] {
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  const candidates: RequirementCandidate[] = []

  for (const entry of parsed) {
    const raw = readRaw(entry)
    if (!raw) continue
    const key = normalizeName(raw.name)
    if (key.length < 4 || seen.has(key)) continue
    seen.add(key)
    candidates.push({
      id: `llm-${candidates.length}`,
      // Reported as the model wrote it: rule 3 of the checklist already knows
      // how to flag a name that is not "infinitive + object" and repair it.
      name: raw.name,
      compliant: isInfinitivePhrase(raw.name),
      actor: raw.actor && !NON_ACTORS.has(normalizeName(raw.actor)) ? raw.actor : null,
      source: raw.source,
    })
  }

  return candidates
}

/**
 * Reads requirements with a chat model instead of the local regular
 * expressions. Same interface, so the panel cannot tell which one ran; the
 * difference is that the document text leaves the browser for the configured
 * URL.
 */
export function createLlmExtractor(config: LlmConfig): RequirementExtractor {
  return {
    id: `llm:${config.model}`,
    label: `Modelo (${config.model})`,
    extract: async (text) => {
      const result = await chat(config, {
        system: SYSTEM_PROMPT,
        user: text.slice(0, MAX_INPUT_CHARS),
        maxTokens: 2048,
      })
      if (!result.ok) throw new Error(result.error)

      const candidates = toCandidates(extractArray(result.value))
      if (candidates.length === 0 && !/\[\s*\]/.test(result.value)) {
        throw new Error('El modelo no devolvió una lista de casos de uso.')
      }
      return candidates
    },
  }
}
