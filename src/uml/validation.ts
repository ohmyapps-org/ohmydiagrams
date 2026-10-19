import {
  type DocumentMeta,
  type UmlEdge,
  type UmlNode,
  nodeKindOf,
} from '../types/uml'
import { contains, intersects, nodeRect } from './geometry'
import {
  associationDegree,
  buildIndex,
  edgesInCycles,
  edgesOfKind,
  hasPurpose,
  reachableUseCasesFromActors,
  type GraphIndex,
} from './graph'
import { isInfinitivePhrase, normalizeName, suggestInfinitivePhrase } from './verbs'

/** `idle` is a rule that was not evaluated because the canvas is empty. */
export type ValidationStatus = 'pass' | 'fail' | 'idle'

/** A one-click repair the checklist can offer for a failing rule. */
export type ValidationFix =
  | { kind: 'reverseEdge'; edgeId: string; label: string }
  | { kind: 'renameNode'; nodeId: string; value: string; label: string }
  | { kind: 'focusMeta'; label: string }

export interface ValidationItem {
  id: string
  /** 1-17, matching the spec's numbering. */
  number: number
  title: string
  status: ValidationStatus
  /** What is wrong, in one line. Empty when the rule passes. */
  message: string
  /** Concrete next action for the user. */
  suggestion: string
  /** Nodes/edges to highlight when the user clicks the item. */
  elementIds: string[]
  fixes: ValidationFix[]
}

interface RuleContext {
  nodes: readonly UmlNode[]
  meta: DocumentMeta
  index: GraphIndex
  actors: UmlNode[]
  useCases: UmlNode[]
  boundaries: UmlNode[]
}

export function pass(
  number: number,
  id: string,
  title: string,
  suggestion = '',
): ValidationItem {
  return {
    id,
    number,
    title,
    status: 'pass',
    message: '',
    suggestion,
    elementIds: [],
    fixes: [],
  }
}

export function fail(
  number: number,
  id: string,
  title: string,
  message: string,
  suggestion: string,
  elementIds: string[] = [],
  fixes: ValidationFix[] = [],
): ValidationItem {
  return { id, number, title, status: 'fail', message, suggestion, elementIds, fixes }
}

const label = (node: UmlNode): string => node.data.label.trim() || 'sin nombre'

const list = (nodes: readonly UmlNode[], max = 3): string => {
  const names = nodes.slice(0, max).map((node) => `"${label(node)}"`)
  const rest = nodes.length - names.length
  return rest > 0 ? `${names.join(', ')} y ${rest} más` : names.join(', ')
}

/* -------------------------------------------------------------------------- */
/* Direction heuristics for rules 11, 13 and 14                               */
/* -------------------------------------------------------------------------- */

/**
 * Direction is fixed when an edge is drawn, so these relations can never be
 * *structurally* reversed. What we can detect is the semantic tell: in UML the
 * base use case is the one an actor talks to, while included and extending use
 * cases are internal fragments. When that pattern is inverted the edge was
 * almost certainly drawn backwards.
 */
function looksReversed(
  index: GraphIndex,
  edge: UmlEdge,
  kind: 'include' | 'extend',
): boolean {
  const sourceLinked = associationDegree(index, edge.source) > 0
  const targetLinked = associationDegree(index, edge.target) > 0
  return kind === 'include'
    ? !sourceLinked && targetLinked
    : sourceLinked && !targetLinked
}

/**
 * A parent normally carries the associations its children inherit. A declared
 * parent with no associations at all, under a child that has several, is the
 * classic reversed triangle.
 */
function generalizationLooksReversed(index: GraphIndex, edge: UmlEdge): boolean {
  return (
    associationDegree(index, edge.target) === 0 &&
    associationDegree(index, edge.source) >= 2
  )
}

/* -------------------------------------------------------------------------- */
/* The 17 rules                                                               */
/* -------------------------------------------------------------------------- */

function ruleHasActors(ctx: RuleContext): ValidationItem {
  const id = 'has-actors'
  const title = 'Hay al menos un actor'
  return ctx.actors.length > 0
    ? pass(1, id, title, `${ctx.actors.length} actor(es) en el diagrama.`)
    : fail(
        1,
        id,
        title,
        'El diagrama no tiene ningún actor.',
        'Arrastrá un Actor desde la paleta y ubicalo fuera del límite del sistema.',
      )
}

function ruleHasUseCases(ctx: RuleContext): ValidationItem {
  const id = 'has-use-cases'
  const title = 'Hay al menos un caso de uso'
  return ctx.useCases.length > 0
    ? pass(2, id, title, `${ctx.useCases.length} caso(s) de uso en el diagrama.`)
    : fail(
        2,
        id,
        title,
        'El diagrama no tiene ningún caso de uso.',
        'Arrastrá un Caso de uso desde la paleta y ubicalo dentro del límite.',
      )
}

function ruleVerbNames(ctx: RuleContext): ValidationItem {
  const id = 'verb-names'
  const title = 'Los casos de uso se nombran con verbo en infinitivo'
  const offenders = ctx.useCases.filter((node) => !isInfinitivePhrase(node.data.label))
  if (offenders.length === 0) {
    return pass(3, id, title, 'Todos usan la forma "verbo + objeto".')
  }
  const first = offenders[0]!
  return fail(
    3,
    id,
    title,
    `${list(offenders)} no usa${offenders.length > 1 ? 'n' : ''} la forma "verbo en infinitivo + objeto".`,
    `Renombralo, por ejemplo "${suggestInfinitivePhrase(first.data.label)}".`,
    offenders.map((node) => node.id),
    offenders.slice(0, 5).map((node) => ({
      kind: 'renameNode' as const,
      nodeId: node.id,
      value: suggestInfinitivePhrase(node.data.label),
      label: `"${label(node)}" -> "${suggestInfinitivePhrase(node.data.label)}"`,
    })),
  )
}

function ruleUniqueNames(ctx: RuleContext): ValidationItem {
  const id = 'unique-names'
  const title = 'Los nombres de casos de uso no se repiten'
  const seen = new Map<string, UmlNode[]>()
  for (const node of ctx.useCases) {
    const key = normalizeName(node.data.label)
    const bucket = seen.get(key)
    if (bucket) bucket.push(node)
    else seen.set(key, [node])
  }
  const duplicated = [...seen.values()].filter((group) => group.length > 1)
  if (duplicated.length === 0) return pass(4, id, title, 'Sin nombres duplicados.')

  const flat = duplicated.flat()
  return fail(
    4,
    id,
    title,
    `Hay nombres repetidos: ${list(duplicated.map((group) => group[0]!))}.`,
    'Cada caso de uso representa una función distinta: dales nombres únicos o unificalos en uno solo.',
    flat.map((node) => node.id),
  )
}

function ruleUseCasesInside(ctx: RuleContext): ValidationItem {
  const id = 'use-cases-inside'
  const title = 'Todos los casos de uso están dentro del límite'
  if (ctx.boundaries.length === 0) {
    return fail(
      5,
      id,
      title,
      'No hay ningún límite del sistema dibujado.',
      'Arrastrá "Límite del sistema" desde la paleta y encerrá los casos de uso.',
      ctx.useCases.map((node) => node.id),
    )
  }
  const boxes = ctx.boundaries.map(nodeRect)
  const outside = ctx.useCases.filter(
    (node) => !boxes.some((box) => contains(box, nodeRect(node))),
  )
  if (outside.length === 0 && ctx.useCases.length > 0) {
    return pass(5, id, title, 'Todos quedan encerrados por el límite.')
  }
  if (ctx.useCases.length === 0) {
    return fail(
      5,
      id,
      title,
      'Todavía no hay casos de uso que ubicar.',
      'Agregá casos de uso dentro del límite del sistema.',
    )
  }
  return fail(
    5,
    id,
    title,
    `${list(outside)} queda${outside.length > 1 ? 'n' : ''} fuera del límite.`,
    'Arrastralos dentro del rectángulo del sistema, o agrandá el límite.',
    outside.map((node) => node.id),
  )
}

function ruleActorsOutside(ctx: RuleContext): ValidationItem {
  const id = 'actors-outside'
  const title = 'Todos los actores están fuera del límite'
  if (ctx.boundaries.length === 0 || ctx.actors.length === 0) {
    return pass(6, id, title, 'Nada que verificar todavía.')
  }
  const boxes = ctx.boundaries.map(nodeRect)
  const inside = ctx.actors.filter((node) =>
    boxes.some((box) => intersects(box, nodeRect(node))),
  )
  return inside.length === 0
    ? pass(6, id, title, 'Los actores quedan fuera del sistema.')
    : fail(
        6,
        id,
        title,
        `${list(inside)} invade${inside.length > 1 ? 'n' : ''} el límite del sistema.`,
        'Los actores son externos al sistema: movelos fuera del rectángulo.',
        inside.map((node) => node.id),
      )
}

function ruleUseCasesConnected(ctx: RuleContext): ValidationItem {
  const id = 'use-cases-connected'
  const title = 'Cada caso de uso llega a un actor'
  if (ctx.useCases.length === 0) {
    return fail(
      7,
      id,
      title,
      'No hay casos de uso para conectar.',
      'Agregá casos de uso y asocialos a sus actores.',
    )
  }
  const grounded = reachableUseCasesFromActors(ctx.index)
  const orphans = ctx.useCases.filter((node) => !grounded.has(node.id))
  return orphans.length === 0
    ? pass(7, id, title, 'Todos tienen un actor que los inicia o los hereda.')
    : fail(
        7,
        id,
        title,
        `${list(orphans)} no llega${orphans.length > 1 ? 'n' : ''} a ningún actor.`,
        'Asocialo a un actor, o conectalo por generalización a un caso de uso que sí lo tenga. Un caso de uso incluido o extensor también necesita que su caso base llegue a un actor.',
        orphans.map((node) => node.id),
      )
}

function ruleActorsHaveAssociations(ctx: RuleContext): ValidationItem {
  const id = 'actors-connected'
  const title = 'Cada actor participa en algo'
  if (ctx.actors.length === 0) {
    return fail(
      8,
      id,
      title,
      'No hay actores para verificar.',
      'Agregá al menos un actor y asocialo a un caso de uso.',
    )
  }
  const idle = ctx.actors.filter((node) => !hasPurpose(ctx.index, node.id))
  return idle.length === 0
    ? pass(8, id, title, 'Ningún actor quedó sin propósito.')
    : fail(
        8,
        id,
        title,
        `${list(idle)} no tiene asociaciones (actor sin propósito).`,
        'Asocialo a los casos de uso en los que participa, o borralo del diagrama.',
        idle.map((node) => node.id),
      )
}

function associationsBetween(
  ctx: RuleContext,
  kind: 'useCase' | 'actor',
): UmlEdge[] {
  return edgesOfKind(ctx.index, 'association').filter((edge) => {
    const source = ctx.index.nodeById.get(edge.source)
    const target = ctx.index.nodeById.get(edge.target)
    return (
      !!source &&
      !!target &&
      nodeKindOf(source) === kind &&
      nodeKindOf(target) === kind
    )
  })
}

function ruleNoUseCaseAssociations(ctx: RuleContext): ValidationItem {
  const id = 'no-use-case-associations'
  const title = 'No hay asociaciones entre casos de uso'
  const offenders = associationsBetween(ctx, 'useCase')
  return offenders.length === 0
    ? pass(9, id, title, 'Las asociaciones sólo unen actores con casos de uso.')
    : fail(
        9,
        id,
        title,
        `${offenders.length} asociación(es) unen dos casos de uso.`,
        'Entre casos de uso sólo valen «include», «extend» o generalización. Cambiá el tipo de la relación en el panel de propiedades.',
        offenders.map((edge) => edge.id),
      )
}

function ruleNoActorAssociations(ctx: RuleContext): ValidationItem {
  const id = 'no-actor-associations'
  const title = 'No hay asociaciones entre actores'
  const offenders = associationsBetween(ctx, 'actor')
  return offenders.length === 0
    ? pass(10, id, title, 'Ningún par de actores está asociado directamente.')
    : fail(
        10,
        id,
        title,
        `${offenders.length} asociación(es) unen dos actores.`,
        'Entre actores sólo vale la generalización. Cambiá el tipo de la relación en el panel de propiedades.',
        offenders.map((edge) => edge.id),
      )
}

function checkDirectedRelation(
  ctx: RuleContext,
  kind: 'include' | 'extend',
  number: number,
  id: string,
  title: string,
  passNote: string,
): ValidationItem {
  const edges = edgesOfKind(ctx.index, kind)
  if (edges.length === 0) {
    return pass(number, id, title, `No hay relaciones «${kind}» que verificar.`)
  }

  const badEndpoints: UmlEdge[] = []
  const selfLinks: UmlEdge[] = []
  const reversed: UmlEdge[] = []

  for (const edge of edges) {
    const source = ctx.index.nodeById.get(edge.source)
    const target = ctx.index.nodeById.get(edge.target)
    if (!source || !target) continue
    if (edge.source === edge.target) {
      selfLinks.push(edge)
      continue
    }
    if (nodeKindOf(source) !== 'useCase' || nodeKindOf(target) !== 'useCase') {
      badEndpoints.push(edge)
      continue
    }
    if (looksReversed(ctx.index, edge, kind)) reversed.push(edge)
  }

  if (badEndpoints.length === 0 && selfLinks.length === 0 && reversed.length === 0) {
    return pass(number, id, title, passNote)
  }

  const problems: string[] = []
  if (selfLinks.length > 0) {
    problems.push(`${selfLinks.length} relación(es) apuntan al mismo caso de uso`)
  }
  if (badEndpoints.length > 0) {
    problems.push(`${badEndpoints.length} conecta(n) algo que no es un caso de uso`)
  }
  if (reversed.length > 0) {
    problems.push(`${reversed.length} parece(n) dibujada(s) al revés`)
  }

  const suggestion =
    kind === 'include'
      ? 'La flecha va del caso base al caso incluido: el incluido es el fragmento compartido, el base es el que el actor inicia.'
      : 'La flecha apunta al caso base: el caso que extiende es el comportamiento opcional, y va como origen.'

  return fail(
    number,
    id,
    title,
    `${problems.join('; ')}.`,
    suggestion,
    [...selfLinks, ...badEndpoints, ...reversed].map((edge) => edge.id),
    reversed.map((edge) => ({
      kind: 'reverseEdge' as const,
      edgeId: edge.id,
      label: `Invertir dirección de ${describeEdge(ctx, edge)}`,
    })),
  )
}

function describeEdge(ctx: RuleContext, edge: UmlEdge): string {
  const source = ctx.index.nodeById.get(edge.source)
  const target = ctx.index.nodeById.get(edge.target)
  return `${source ? label(source) : '?'} -> ${target ? label(target) : '?'}`
}

function ruleIncludeDirection(ctx: RuleContext): ValidationItem {
  return checkDirectedRelation(
    ctx,
    'include',
    11,
    'include-direction',
    '«include» va del caso base al incluido',
    'Todas las relaciones «include» apuntan al caso incluido.',
  )
}

function ruleNoIncludeCycles(ctx: RuleContext): ValidationItem {
  const id = 'no-include-cycles'
  const title = 'No hay ciclos de «include»'
  const edges = edgesOfKind(ctx.index, 'include')
  const cyclic = edgesInCycles(edges)
  return cyclic.size === 0
    ? pass(12, id, title, 'La jerarquía de inclusión es acíclica.')
    : fail(
        12,
        id,
        title,
        `${cyclic.size} relación(es) «include» forman un ciclo.`,
        'Un caso de uso no puede incluirse a sí mismo ni, indirectamente, volver sobre su base: eliminá una de las relaciones del ciclo.',
        [...cyclic],
      )
}

function ruleExtendDirection(ctx: RuleContext): ValidationItem {
  const base = checkDirectedRelation(
    ctx,
    'extend',
    13,
    'extend-direction',
    '«extend» apunta al caso base',
    'Todas las relaciones «extend» apuntan al caso base.',
  )
  if (base.status === 'fail') return base

  // Cycles are checked with rule 12's routine; an extend loop is just as invalid.
  const cyclic = edgesInCycles(edgesOfKind(ctx.index, 'extend'))
  if (cyclic.size === 0) return base
  return fail(
    13,
    base.id,
    base.title,
    `${cyclic.size} relación(es) «extend» forman un ciclo.`,
    'Dos casos de uso no pueden extenderse mutuamente: quitá una de las relaciones.',
    [...cyclic],
  )
}

function ruleGeneralizationDirection(ctx: RuleContext): ValidationItem {
  const id = 'generalization-direction'
  const title = 'El triángulo apunta al padre'
  const edges = edgesOfKind(ctx.index, 'generalization')
  if (edges.length === 0) {
    return pass(14, id, title, 'No hay generalizaciones que verificar.')
  }

  const cyclic = edgesInCycles(edges)
  const reversed = edges.filter(
    (edge) => !cyclic.has(edge.id) && generalizationLooksReversed(ctx.index, edge),
  )

  if (cyclic.size === 0 && reversed.length === 0) {
    return pass(14, id, title, 'Cada triángulo descansa sobre el elemento padre.')
  }

  const problems: string[] = []
  if (cyclic.size > 0) problems.push(`${cyclic.size} forman una jerarquía circular`)
  if (reversed.length > 0) {
    problems.push(`${reversed.length} parece(n) invertida(s): el padre no tiene asociaciones y el hijo sí`)
  }

  return fail(
    14,
    id,
    title,
    `${problems.join('; ')}.`,
    'El triángulo hueco se apoya en el padre; el hijo hereda sus asociaciones y va como origen de la flecha.',
    [...cyclic, ...reversed.map((edge) => edge.id)],
    reversed.map((edge) => ({
      kind: 'reverseEdge' as const,
      edgeId: edge.id,
      label: `Invertir dirección de ${describeEdge(ctx, edge)}`,
    })),
  )
}

function ruleGeneralizationTypes(ctx: RuleContext): ValidationItem {
  const id = 'generalization-types'
  const title = 'La generalización une elementos del mismo tipo'
  const offenders = edgesOfKind(ctx.index, 'generalization').filter((edge) => {
    const source = ctx.index.nodeById.get(edge.source)
    const target = ctx.index.nodeById.get(edge.target)
    if (!source || !target) return false
    const from = nodeKindOf(source)
    const to = nodeKindOf(target)
    if (from !== to) return true
    return from !== 'actor' && from !== 'useCase'
  })
  return offenders.length === 0
    ? pass(15, id, title, 'Actor con actor, caso de uso con caso de uso.')
    : fail(
        15,
        id,
        title,
        `${offenders.length} generalización(es) unen tipos distintos.`,
        'Sólo se generaliza entre actores, o entre casos de uso. Cambiá el tipo de uno de los extremos o borrá la relación.',
        offenders.map((edge) => edge.id),
      )
}

function ruleHasTitle(ctx: RuleContext): ValidationItem {
  const id = 'has-title'
  const title = 'El diagrama tiene título'
  return ctx.meta.title.trim().length > 0
    ? pass(16, id, title, `Título: "${ctx.meta.title.trim()}".`)
    : fail(
        16,
        id,
        title,
        'El diagrama no tiene título.',
        'Escribí el nombre del diagrama en la barra superior; se incluye en las exportaciones.',
        [],
        [{ kind: 'focusMeta', label: 'Poner título' }],
      )
}

function ruleNoFloatingElements(ctx: RuleContext): ValidationItem {
  const id = 'no-floating'
  const title = 'No hay elementos sueltos'
  const floating = ctx.nodes.filter((node) => {
    const kind = nodeKindOf(node)
    // The boundary is a container and text labels are annotations: neither
    // needs a connector to be meaningful.
    if (kind === 'boundary' || kind === 'text') return false
    return (ctx.index.incident.get(node.id) ?? []).length === 0
  })
  return floating.length === 0
    ? pass(17, id, title, 'Todo elemento participa en al menos una relación.')
    : fail(
        17,
        id,
        title,
        `${list(floating)} no participa${floating.length > 1 ? 'n' : ''} en ninguna relación.`,
        'Conectalo con la relación que corresponda, o quitalo del diagrama. Las notas se enlazan con el conector de nota.',
        floating.map((node) => node.id),
      )
}

const RULES: readonly ((ctx: RuleContext) => ValidationItem)[] = [
  ruleHasActors,
  ruleHasUseCases,
  ruleVerbNames,
  ruleUniqueNames,
  ruleUseCasesInside,
  ruleActorsOutside,
  ruleUseCasesConnected,
  ruleActorsHaveAssociations,
  ruleNoUseCaseAssociations,
  ruleNoActorAssociations,
  ruleIncludeDirection,
  ruleNoIncludeCycles,
  ruleExtendDirection,
  ruleGeneralizationDirection,
  ruleGeneralizationTypes,
  ruleHasTitle,
  ruleNoFloatingElements,
]

export interface ValidationReport {
  items: ValidationItem[]
  passed: number
  total: number
  /** Nothing was drawn yet: every item is `idle` and nothing failed. */
  blank: boolean
}

/**
 * The same rule, unevaluated. An empty canvas breaks no rule: reporting 17
 * failures before the first shape is drawn is noise, not feedback.
 */
export function waiting(item: ValidationItem): ValidationItem {
  return {
    ...item,
    status: 'idle',
    message: '',
    suggestion: '',
    elementIds: [],
    fixes: [],
  }
}

/** Pure evaluation of the whole checklist against the current document. */
export function validate(
  nodes: readonly UmlNode[],
  edges: readonly UmlEdge[],
  meta: DocumentMeta,
): ValidationReport {
  const index = buildIndex(nodes, edges)
  const ctx: RuleContext = {
    nodes,
    meta,
    index,
    actors: index.nodesOfKind('actor'),
    useCases: index.nodesOfKind('useCase'),
    boundaries: index.nodesOfKind('boundary'),
  }
  const items = RULES.map((rule) => rule(ctx)).sort((a, b) => a.number - b.number)
  // The rules still run on a blank document, only to keep their numbering and
  // titles in one place; their verdicts are dropped.
  if (nodes.length === 0 && edges.length === 0) {
    return { items: items.map(waiting), passed: 0, total: items.length, blank: true }
  }
  return {
    items,
    passed: items.filter((item) => item.status === 'pass').length,
    total: items.length,
    blank: false,
  }
}

/** Ids of every element flagged by a failing rule, for canvas highlighting. */
export function flaggedElementIds(report: ValidationReport): Set<string> {
  const ids = new Set<string>()
  for (const item of report.items) {
    if (item.status !== 'fail') continue
    for (const id of item.elementIds) ids.add(id)
  }
  return ids
}
