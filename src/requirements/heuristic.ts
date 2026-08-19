import { isInfinitivePhrase, normalizeName } from '../uml/verbs'
import type { RequirementCandidate, RequirementExtractor } from './types'

/** Bullets, numbering and requirement codes ("RF-01:") that precede the text. */
const LEAD_NOISE = /^\s*(?:[-*•·—]+|\d+[.)]|(?:RF|RNF|REQ|R)[-\s]?\d+)\s*[.:)-]?\s*/i

/**
 * The phrase that introduces a capability. Group 1, when present, is the actor
 * the sentence puts in front of the verb.
 */
const MODALS: readonly RegExp[] = [
  /(?:^|\b)el\s+sistema\s+(?:deber[áa]?|debe|debería|tiene\s+que|permitir[áa]?|permite|podr[áa])\s+/i,
  /(?:^|\b)se\s+(?:debe|deber[áa]|podr[áa]|permitir[áa]?)\s+/i,
  /(?:^|\b)(?:el|la|los|las)\s+([a-záéíóúñ]+)\s+(?:deber[áa]?|debe|podr[áa]|puede|tiene\s+que|necesita)\s+/i,
  /(?:^|\b)como\s+([a-záéíóúñ\s]+?)\s+(?:quiero|necesito|deseo)\s+/i,
  /(?:^|\b)the\s+system\s+(?:shall|must|should|will|can)\s+/i,
  /(?:^|\b)(?:the\s+)?([a-z]+)\s+(?:shall|must|should)\s+/i,
]

/** Verbs that only enable the real action: "debe permitir registrar ventas". */
const ENABLERS = new Set([
  'permitir', 'permitirle', 'poder', 'poderse', 'be', 'able', 'to', 'allow', 'let', 'enable',
])

const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'the', 'a', 'an'])

/** What follows these is a condition or a complement, not the verb's object. */
const BREAKERS = new Set([
  'y', 'o', 'u', 'e', 'de', 'del', 'al', 'en', 'con', 'sin', 'por', 'para',
  'desde', 'hasta', 'sobre', 'segun', 'según', 'mediante', 'cuando', 'si',
  'antes', 'despues', 'después', 'que',
  'and', 'or', 'of', 'in', 'on', 'with', 'without', 'for', 'from', 'to',
  'when', 'if', 'before', 'after', 'that',
])

const MAX_OBJECT_WORDS = 3

function sentences(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.;:!?])\s+/)
    .map((line) => line.replace(LEAD_NOISE, '').trim())
    .filter((line) => line.length > 8)
}

/**
 * Cuts the action phrase down to "verb + short object": the enabling verb and
 * the articles go, and the object stops at the first preposition or
 * conjunction, which is where the sentence stops naming and starts qualifying.
 */
function trimToPhrase(action: string): string {
  const tokens = action
    .replace(/[.;:,!?].*$/, '')
    .split(/\s+/)
    .filter(Boolean)

  let index = 0
  while (index < tokens.length) {
    const token = normalizeName(tokens[index] as string)
    if (!ENABLERS.has(token) && !ARTICLES.has(token)) break
    index += 1
  }

  const verb = tokens[index]
  if (!verb) return ''

  const object: string[] = []
  for (const token of tokens.slice(index + 1)) {
    if (object.length === MAX_OBJECT_WORDS) break
    const normalized = normalizeName(token)
    if (BREAKERS.has(normalized)) break
    // A leading article belongs to the object, not in front of it.
    if (ARTICLES.has(normalized)) {
      if (object.length === 0) continue
      break
    }
    object.push(token)
  }

  return [verb, ...object].join(' ')
}

function titleCase(phrase: string): string {
  const clean = phrase.trim().replace(/\s+/g, ' ')
  if (!clean) return ''
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
}

/** Roles that read as the system itself rather than as an actor. */
const NON_ACTORS = new Set(['sistema', 'system', 'aplicacion', 'aplicación', 'software'])

function actorFrom(match: RegExpMatchArray): string | null {
  const raw = match[1]?.trim()
  if (!raw) return null
  const normalized = normalizeName(raw)
  if (!normalized || NON_ACTORS.has(normalized)) return null
  return titleCase(raw)
}

function candidateFrom(sentence: string, index: number): RequirementCandidate | null {
  for (const modal of MODALS) {
    const match = sentence.match(modal)
    if (!match || match.index === undefined) continue

    const phrase = trimToPhrase(sentence.slice(match.index + match[0].length))
    if (!phrase) continue

    const name = titleCase(phrase)
    return {
      id: `req-${index}`,
      // Names are reported as written: the checklist already knows how to
      // flag and repair one that is not "infinitive + object".
      name,
      compliant: isInfinitivePhrase(name),
      actor: actorFrom(match),
      source: sentence,
    }
  }
  return null
}

/**
 * Reads requirement prose and proposes use cases. It looks for the sentences
 * that state a capability ("el sistema debe permitir...", "the system shall
 * ...") and keeps the verb plus its object, which is the shape UML 2.5 asks
 * for in a use case name.
 */
export const heuristicExtractor: RequirementExtractor = {
  id: 'heuristic',
  label: 'Lectura local (sin modelo)',
  extract: (text) => {
    const seen = new Set<string>()
    const candidates: RequirementCandidate[] = []

    sentences(text).forEach((sentence, index) => {
      const candidate = candidateFrom(sentence, index)
      if (!candidate) return
      const key = normalizeName(candidate.name)
      if (key.length < 4 || seen.has(key)) return
      seen.add(key)
      candidates.push(candidate)
    })

    return Promise.resolve(candidates)
  },
}
