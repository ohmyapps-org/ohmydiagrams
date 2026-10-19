import {
  isClassifierKind,
  nodeKindOf,
  type DocumentMeta,
  type UmlEdge,
  type UmlEdgeKind,
  type UmlNode,
} from '../types/uml'
import { buildIndex, edgesInCycles, edgesOfKind, type GraphIndex } from './graph'
import {
  fail,
  pass,
  waiting,
  type ValidationItem,
  type ValidationReport,
} from './validation'

interface RuleContext {
  nodes: readonly UmlNode[]
  meta: DocumentMeta
  index: GraphIndex
  classifiers: UmlNode[]
}

const label = (node: UmlNode): string => node.data.label.trim() || 'sin nombre'

const list = (nodes: readonly UmlNode[], max = 3): string => {
  const names = nodes.slice(0, max).map((node) => `"${label(node)}"`)
  const rest = nodes.length - names.length
  return rest > 0 ? `${names.join(', ')} y ${rest} más` : names.join(', ')
}

const FOREIGN_KINDS = new Set(['actor', 'useCase', 'boundary'])

const CLASS_RELATIONS: readonly UmlEdgeKind[] = [
  'association',
  'aggregation',
  'composition',
  'dependency',
  'generalization',
  'realization',
]

/** First character is an uppercase letter (including accented Spanish ones). */
export function isClassifierName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  const first = trimmed[0]!
  return first === first.toUpperCase() && first !== first.toLowerCase()
}

export function suggestClassifierName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'Clase'
  return trimmed[0]!.toUpperCase() + trimmed.slice(1)
}

function ruleHasClassifiers(ctx: RuleContext): ValidationItem {
  const id = 'has-classifiers'
  const title = 'Hay al menos una clase'
  return ctx.classifiers.length > 0
    ? pass(1, id, title, `${ctx.classifiers.length} clasificador(es) en el diagrama.`)
    : fail(
        1,
        id,
        title,
        'El diagrama no tiene ninguna clase, interfaz ni enumeración.',
        'Arrastrá una Clase desde la paleta.',
      )
}

function ruleNamedClassifiers(ctx: RuleContext): ValidationItem {
  const id = 'named-classifiers'
  const title = 'Cada clasificador tiene nombre'
  const unnamed = ctx.classifiers.filter((node) => !node.data.label.trim())
  return unnamed.length === 0
    ? pass(2, id, title, 'Todos los clasificadores están nombrados.')
    : fail(
        2,
        id,
        title,
        `${unnamed.length} clasificador(es) sin nombre.`,
        'Doble clic sobre la clase y escribí un sustantivo del dominio.',
        unnamed.map((node) => node.id),
      )
}

function ruleUniqueNames(ctx: RuleContext): ValidationItem {
  const id = 'unique-classifier-names'
  const title = 'Los nombres de clasificador no se repiten'
  const seen = new Map<string, UmlNode[]>()
  for (const node of ctx.classifiers) {
    const key = node.data.label.trim().toLowerCase()
    if (!key) continue
    const bucket = seen.get(key)
    if (bucket) bucket.push(node)
    else seen.set(key, [node])
  }
  const duplicated = [...seen.values()].filter((group) => group.length > 1)
  if (duplicated.length === 0) return pass(3, id, title, 'Sin nombres duplicados.')

  const flat = duplicated.flat()
  return fail(
    3,
    id,
    title,
    `Hay nombres repetidos: ${list(duplicated.map((group) => group[0]!))}.`,
    'Cada clasificador representa un concepto distinto: dales nombres únicos o unificalos.',
    flat.map((node) => node.id),
  )
}

function ruleClassifierNames(ctx: RuleContext): ValidationItem {
  const id = 'classifier-names'
  const title = 'Los nombres empiezan con mayúscula'
  const offenders = ctx.classifiers.filter(
    (node) => node.data.label.trim() && !isClassifierName(node.data.label),
  )
  if (offenders.length === 0) {
    return pass(4, id, title, 'Todos usan un identificador con mayúscula inicial.')
  }
  const first = offenders[0]!
  const suggested = suggestClassifierName(first.data.label)
  return fail(
    4,
    id,
    title,
    `${list(offenders)} no usa${offenders.length > 1 ? 'n' : ''} mayúscula inicial.`,
    `Renombralo, por ejemplo "${suggested}".`,
    offenders.map((node) => node.id),
    offenders.slice(0, 5).map((node) => ({
      kind: 'renameNode' as const,
      nodeId: node.id,
      value: suggestClassifierName(node.data.label),
      label: `"${label(node)}" -> "${suggestClassifierName(node.data.label)}"`,
    })),
  )
}

function ruleNoForeignElements(ctx: RuleContext): ValidationItem {
  const id = 'no-foreign-elements'
  const title = 'No hay elementos de otro tipo de diagrama'
  const foreign = ctx.nodes.filter((node) => FOREIGN_KINDS.has(nodeKindOf(node)))
  return foreign.length === 0
    ? pass(5, id, title, 'Sólo hay clasificadores, notas y formas de dibujo.')
    : fail(
        5,
        id,
        title,
        `${list(foreign)} no pertenece${foreign.length > 1 ? 'n' : ''} a un diagrama de clases.`,
        'Los actores, casos de uso y el límite del sistema van en un diagrama de casos de uso. Cambiá el tipo en propiedades o borralos.',
        foreign.map((node) => node.id),
      )
}

function describeEdge(ctx: RuleContext, edge: UmlEdge): string {
  const source = ctx.index.nodeById.get(edge.source)
  const target = ctx.index.nodeById.get(edge.target)
  return `${source ? label(source) : '?'} -> ${target ? label(target) : '?'}`
}

function ruleClassRelationEndpoints(ctx: RuleContext): ValidationItem {
  const id = 'class-relation-endpoints'
  const title = 'Las relaciones UML unen clasificadores'
  const offenders: UmlEdge[] = []
  for (const kind of CLASS_RELATIONS) {
    for (const edge of edgesOfKind(ctx.index, kind)) {
      const source = ctx.index.nodeById.get(edge.source)
      const target = ctx.index.nodeById.get(edge.target)
      if (!source || !target) continue
      if (
        !isClassifierKind(nodeKindOf(source)) ||
        !isClassifierKind(nodeKindOf(target))
      ) {
        offenders.push(edge)
      }
    }
  }
  return offenders.length === 0
    ? pass(
        6,
        id,
        title,
        'Asociación, herencia y el resto unen clases, interfaces o enumeraciones.',
      )
    : fail(
        6,
        id,
        title,
        `${offenders.length} relación(es) tocan algo que no es un clasificador.`,
        'Esas relaciones sólo unen clases, interfaces o enumeraciones. El conector de nota es el que anota cualquier forma.',
        offenders.map((edge) => edge.id),
      )
}

function ruleGeneralizationTypes(ctx: RuleContext): ValidationItem {
  const id = 'class-generalization-types'
  const title = 'La generalización une clasificadores del mismo tipo'
  const offenders = edgesOfKind(ctx.index, 'generalization').filter((edge) => {
    const source = ctx.index.nodeById.get(edge.source)
    const target = ctx.index.nodeById.get(edge.target)
    if (!source || !target) return false
    return nodeKindOf(source) !== nodeKindOf(target)
  })
  return offenders.length === 0
    ? pass(
        7,
        id,
        title,
        'Clase con clase, interfaz con interfaz, enumeración con enumeración.',
      )
    : fail(
        7,
        id,
        title,
        `${offenders.length} generalización(es) unen tipos distintos.`,
        'Para que una clase implemente una interfaz usá Realización. La generalización sólo hereda entre el mismo tipo de clasificador.',
        offenders.map((edge) => edge.id),
      )
}

function ruleNoGeneralizationCycles(ctx: RuleContext): ValidationItem {
  const id = 'no-generalization-cycles'
  const title = 'No hay ciclos de generalización'
  const edges = edgesOfKind(ctx.index, 'generalization')
  const cyclic = edgesInCycles(edges)
  return cyclic.size === 0
    ? pass(8, id, title, 'La jerarquía de herencia es acíclica.')
    : fail(
        8,
        id,
        title,
        `${cyclic.size} generalización(es) forman un ciclo.`,
        'Una clase no puede ser, ni siquiera de forma indirecta, ancestro de sí misma: eliminá una relación del ciclo.',
        [...cyclic],
      )
}

function ruleNoCompositionCycles(ctx: RuleContext): ValidationItem {
  const id = 'no-composition-cycles'
  const title = 'La composición no forma ciclos'
  const edges = edgesOfKind(ctx.index, 'composition')
  const selfLinks = edges.filter((edge) => edge.source === edge.target)
  const cyclic = edgesInCycles(edges)
  const aggregationSelf = edgesOfKind(ctx.index, 'aggregation').filter(
    (edge) => edge.source === edge.target,
  )
  if (cyclic.size === 0 && aggregationSelf.length === 0) {
    return pass(9, id, title, 'Ningún compuesto es parte de sí mismo.')
  }
  const problems: string[] = []
  if (cyclic.size > 0) {
    problems.push(
      `${cyclic.size} composición(es) ${selfLinks.length > 0 && cyclic.size === selfLinks.length ? 'apuntan a la misma clase' : 'forman un ciclo'}`,
    )
  }
  if (aggregationSelf.length > 0) {
    problems.push(`${aggregationSelf.length} agregación(es) unen una clase consigo misma`)
  }
  return fail(
    9,
    id,
    title,
    `${problems.join('; ')}.`,
    'El diamante va en el todo y la parte es otro clasificador. Una clase no puede componerse ni agregarse a sí misma.',
    [...cyclic, ...aggregationSelf.map((edge) => edge.id)],
  )
}

function ruleRealizationDirection(ctx: RuleContext): ValidationItem {
  const id = 'realization-direction'
  const title = 'La realización va de una clase a una interfaz'
  const edges = edgesOfKind(ctx.index, 'realization')
  if (edges.length === 0) {
    return pass(10, id, title, 'No hay realizaciones que verificar.')
  }
  const offenders = edges.filter((edge) => {
    const source = ctx.index.nodeById.get(edge.source)
    const target = ctx.index.nodeById.get(edge.target)
    if (!source || !target) return false
    const from = nodeKindOf(source)
    const to = nodeKindOf(target)
    if (to !== 'interface') return true
    return from !== 'class' && from !== 'enumeration'
  })
  return offenders.length === 0
    ? pass(10, id, title, 'Todas las realizaciones apuntan a una interfaz.')
    : fail(
        10,
        id,
        title,
        `${offenders.length} realización(es) no van de una clase a una interfaz.`,
        'Arrastrá de la clase (u enumeración) hacia la interfaz que implementa. Invertí la dirección si quedó al revés.',
        offenders.map((edge) => edge.id),
        offenders.map((edge) => ({
          kind: 'reverseEdge' as const,
          edgeId: edge.id,
          label: `Invertir dirección de ${describeEdge(ctx, edge)}`,
        })),
      )
}

function ruleHasTitle(ctx: RuleContext): ValidationItem {
  const id = 'class-has-title'
  const title = 'El diagrama tiene título'
  return ctx.meta.title.trim().length > 0
    ? pass(11, id, title, `Título: "${ctx.meta.title.trim()}".`)
    : fail(
        11,
        id,
        title,
        'El diagrama no tiene título.',
        'Escribí el nombre del diagrama en la barra superior; se incluye en las exportaciones.',
        [],
        [{ kind: 'focusMeta', label: 'Poner título' }],
      )
}

function ruleNotesLinked(ctx: RuleContext): ValidationItem {
  const id = 'notes-linked'
  const title = 'Las notas están enlazadas'
  const notes = ctx.index.nodesOfKind('note')
  const floating = notes.filter(
    (node) => (ctx.index.incident.get(node.id) ?? []).length === 0,
  )
  return floating.length === 0
    ? pass(
        12,
        id,
        title,
        notes.length === 0 ? 'No hay notas sueltas.' : 'Cada nota anota algo.',
      )
    : fail(
        12,
        id,
        title,
        `${list(floating)} no anota${floating.length > 1 ? 'n' : ''} ningún elemento.`,
        'Usá el conector de nota, o borrala si ya no hace falta.',
        floating.map((node) => node.id),
      )
}

const RULES: readonly ((ctx: RuleContext) => ValidationItem)[] = [
  ruleHasClassifiers,
  ruleNamedClassifiers,
  ruleUniqueNames,
  ruleClassifierNames,
  ruleNoForeignElements,
  ruleClassRelationEndpoints,
  ruleGeneralizationTypes,
  ruleNoGeneralizationCycles,
  ruleNoCompositionCycles,
  ruleRealizationDirection,
  ruleHasTitle,
  ruleNotesLinked,
]

export function validateClass(
  nodes: readonly UmlNode[],
  edges: readonly UmlEdge[],
  meta: DocumentMeta,
): ValidationReport {
  const index = buildIndex(nodes, edges)
  const ctx: RuleContext = {
    nodes,
    meta,
    index,
    classifiers: nodes.filter((node) => isClassifierKind(nodeKindOf(node))),
  }
  const items = RULES.map((rule) => rule(ctx)).sort((a, b) => a.number - b.number)
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
