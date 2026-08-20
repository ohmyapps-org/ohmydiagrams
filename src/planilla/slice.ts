import { actorKey, type PlanillaActor, type PlanillaModel } from './model'

/**
 * Narrows a specification down to one actor, so a thirty-case model can be read
 * as a handful of diagrams instead of one wall.
 *
 * What lands in the slice:
 *
 * - the use cases the actor invokes directly;
 * - whatever those pull in through «include» and «extend», to a fixed point,
 *   because a base case shown without the behaviour it factors out is not the
 *   case the planilla specifies;
 * - every actor that starts one of those use cases, and nothing else.
 *
 * That last rule is why an ancestor whose own use cases are not shown does not
 * appear. Drawing it would leave an actor with no association facing a child
 * with several, which is the exact shape rule 14 reads as a generalization
 * pointing the wrong way. The inheritance is not lost, it moves to the caption:
 * the full diagram is where the hierarchy belongs.
 */
export function sliceForActor(model: PlanillaModel, actorName: string): PlanillaModel {
  const key = actorKey(actorName)
  const root = model.actors.find((actor) => actorKey(actor.name) === key)
  if (!root) {
    return { ...model, actors: [], useCases: [], relations: [], title: actorName }
  }

  const codes = new Set(
    model.useCases
      .filter((useCase) => useCase.actor && actorKey(useCase.actor) === key)
      .map((useCase) => useCase.code),
  )
  expand(model, codes)

  const useCases = model.useCases.filter((useCase) => codes.has(useCase.code))
  const owners = new Set(
    useCases.flatMap((useCase) => (useCase.actor ? [actorKey(useCase.actor)] : [])),
  )
  const actors = model.actors.filter((actor) => owners.has(actorKey(actor.name)))
  const kept = new Set(actors.map((actor) => actorKey(actor.name)))

  return {
    ...model,
    title: `${root.name} · casos de uso`,
    description: caption(model, root, useCases.length),
    actors: actors.map((actor) => ({
      ...actor,
      // A parent left out of the slice would dangle; drop the edge, not the actor.
      generalizes:
        actor.generalizes && kept.has(actorKey(actor.generalizes)) ? actor.generalizes : null,
    })),
    useCases,
    relations: model.relations.filter(
      (relation) => codes.has(relation.from) && codes.has(relation.to),
    ),
  }
}

/** Every actor slice of a model, in the order the actors were declared. */
export function sliceByActor(model: PlanillaModel): { actor: string; model: PlanillaModel }[] {
  return model.actors.map((actor) => ({
    actor: actor.name,
    model: sliceForActor(model, actor.name),
  }))
}

function caption(model: PlanillaModel, root: PlanillaActor, shown: number): string {
  const inherited = chainOf(model, actorKey(root.name))
  const base = `${shown} casos de uso de ${root.name}, con los casos que estos incluyen o extienden.`
  return inherited.length === 0
    ? base
    : `${base} Por generalización también accede a los de ${inherited.join(', ')}.`
}

/** The names of the actors this one specialises, transitively. */
function chainOf(model: PlanillaModel, start: string): string[] {
  const seen = new Set<string>([start])
  const names: string[] = []
  let current = model.actors.find((actor) => actorKey(actor.name) === start)

  while (current?.generalizes) {
    const parentKey = actorKey(current.generalizes)
    if (seen.has(parentKey)) break // A cycle in the document, not a hierarchy.
    seen.add(parentKey)
    const parent = model.actors.find((actor) => actorKey(actor.name) === parentKey)
    if (!parent) break
    names.push(parent.name)
    current = parent
  }
  return names
}

/**
 * Grows the set forward along the relationships: an included case joins its
 * base, and an extension joins the case it extends. Only forward, so asking for
 * Solicitante does not drag in Administrador's cases just because both include
 * the same factored one.
 */
function expand(model: PlanillaModel, codes: Set<string>): void {
  let changed = true
  while (changed) {
    changed = false
    for (const relation of model.relations) {
      // include: base -> included. extend: extension -> base.
      const anchor = relation.kind === 'include' ? relation.from : relation.to
      const pulled = relation.kind === 'include' ? relation.to : relation.from
      if (codes.has(anchor) && !codes.has(pulled)) {
        codes.add(pulled)
        changed = true
      }
    }
  }
}
