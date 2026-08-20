import type { DiagramKind } from '../types/document'
import type { UmlDocument } from '../types/uml'
import { layoutPlanilla } from './layout'
import type { PlanillaModel } from './model'
import { parsePlanilla } from './parse'

export type { PlanillaActor, PlanillaModel, PlanillaRelation, PlanillaUseCase } from './model'
export { parsePlanilla } from './parse'
export { layoutPlanilla } from './layout'
export { sliceByActor, sliceForActor } from './slice'

export interface PlanillaImport {
  document: UmlDocument
  model: PlanillaModel
}

/**
 * Markdown specification in, laid-out diagram out.
 *
 * Kept as one call because that is the whole feature from the outside: the
 * caller has a file and wants a canvas. The two halves stay separately
 * exported for the cases that need them — a preview that lists what was found
 * before drawing anything, or a different layout over the same model.
 */
export function importPlanilla(
  markdown: string,
  kind: DiagramKind = 'useCase',
): PlanillaImport {
  const model = parsePlanilla(markdown)
  return { document: layoutPlanilla(model, kind), model }
}
