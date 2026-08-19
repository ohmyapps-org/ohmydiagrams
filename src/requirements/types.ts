/** One use case proposed by reading a requirements document. */
export interface RequirementCandidate {
  id: string
  /** Proposed use case name, ideally infinitive verb + object. */
  name: string
  /** True when `name` already satisfies rule 3 of the checklist. */
  compliant: boolean
  /** Actor the sentence points at, when it names one. */
  actor: string | null
  /** Sentence it was read from, kept for traceability. */
  source: string
}

/**
 * Turning prose into use cases is the one step where a language model would
 * beat a regular expression, so the step is an interface: the shipped
 * implementation is local and deterministic, and an LLM-backed one can be
 * dropped in through `setRequirementExtractor` without touching the UI.
 */
export interface RequirementExtractor {
  id: string
  label: string
  extract: (text: string) => Promise<RequirementCandidate[]>
}
