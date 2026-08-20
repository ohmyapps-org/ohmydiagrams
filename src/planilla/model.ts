/**
 * The structured shape of a use case specification written in Markdown.
 *
 * This is deliberately *not* `RequirementCandidate`. That interface models the
 * uncertain step of reading prose and guessing at capabilities; this one models
 * a document that already states the model explicitly, in tables and planillas.
 * Nothing here is inferred, so nothing here needs a confidence flag or a source
 * sentence: every field was written down by a person on purpose.
 */

export interface PlanillaActor {
  name: string
  /** The more general actor this one specialises, when the document names one. */
  generalizes: string | null
  description: string
}

export interface PlanillaUseCase {
  /** Document code, e.g. `CU-01`. Unique, and the key every table joins on. */
  code: string
  name: string
  /**
   * Actor that invokes it. `null` for factored cases that exist only as the
   * target of an «include», which no actor calls directly.
   */
  actor: string | null
}

/**
 * A directed UML relationship between two use cases, stored the way the canvas
 * stores it: `from` is the source endpoint, `to` the target.
 *
 * For `include` that is base -> included; for `extend`, extension -> base. The
 * parser flips the document's own phrasing ("incluido por", "extiende a") into
 * this orientation so the layout never has to think about it again.
 */
export interface PlanillaRelation {
  kind: 'include' | 'extend'
  from: string
  to: string
  /** The document's justification for the relationship, kept for traceability. */
  note: string
}

export interface PlanillaModel {
  /** Diagram title. Rule 16 of the checklist wants one. */
  title: string
  /** Label for the system boundary. */
  system: string
  /** Caption under the title. Defaults to a count of what was read. */
  description?: string
  actors: PlanillaActor[]
  useCases: PlanillaUseCase[]
  relations: PlanillaRelation[]
  /**
   * Everything the parser could not resolve: a relationship pointing at a code
   * no table declares, a planilla naming an unknown actor, a duplicate code.
   * Surfaced rather than dropped, because a silently missing edge looks exactly
   * like a correctly modelled absence.
   */
  warnings: string[]
}

/** Strips diacritics and case so "Administrador raíz" matches "Administrador raiz". */
export function actorKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
