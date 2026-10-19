import {
  EDGE_SPECS,
  isClassifierKind,
  type UmlEdgeKind,
  type UmlNode,
  type UmlNodeKind,
  nodeKindOf,
} from '../types/uml'

export interface ConnectionVerdict {
  ok: boolean
  /** Spanish explanation of the UML 2.5 rule that was broken. */
  reason?: string
}

const OK: ConnectionVerdict = { ok: true }

function deny(reason: string): ConnectionVerdict {
  return { ok: false, reason }
}

const UML_ENDPOINTS: readonly UmlNodeKind[] = ['actor', 'useCase']

/**
 * Endpoint legality for §4.2. Returns the exact rule text to show in a toast so
 * the user learns the notation instead of just being blocked.
 *
 * Note this only guards *drawing*. A document can still become invalid by
 * importing JSON or by changing an element's kind in the properties panel —
 * that is what the checklist (rules 9, 10, 15) is for.
 */
export function canConnect(
  kind: UmlEdgeKind,
  source: UmlNode,
  target: UmlNode,
): ConnectionVerdict {
  const from = nodeKindOf(source)
  const to = nodeKindOf(target)
  const selfLink = source.id === target.id

  if (kind === 'noteLink') {
    if (from !== 'note' && to !== 'note') {
      return deny('Un conector de nota debe tener una nota en alguno de sus extremos.')
    }
    return selfLink ? deny('Una nota no puede conectarse a sí misma.') : OK
  }

  if (kind === 'arrow') {
    return selfLink ? deny('Una flecha necesita dos elementos distintos.') : OK
  }

  if (from === 'boundary' || to === 'boundary') {
    return deny(
      'El límite del sistema no se conecta: contiene los casos de uso, no participa en relaciones.',
    )
  }

  if (kind === 'aggregation' || kind === 'composition') {
    if (selfLink) {
      return deny(
        kind === 'composition'
          ? 'Una clase no puede componerse a sí misma.'
          : 'Una clase no puede agregarse a sí misma.',
      )
    }
    if (!isClassifierKind(from) || !isClassifierKind(to)) {
      return deny('Agregación y composición unen clases, interfaces o enumeraciones.')
    }
    return OK
  }

  if (kind === 'dependency') {
    if (selfLink) return deny('Una dependencia necesita dos elementos distintos.')
    if (!isClassifierKind(from) || !isClassifierKind(to)) {
      return deny(
        'La dependencia une clasificadores (clases, interfaces o enumeraciones).',
      )
    }
    return OK
  }

  if (kind === 'realization') {
    if (selfLink) return deny('Una clase no puede realizar su propia interfaz.')
    if (from !== 'class' && from !== 'enumeration') {
      return deny('La realización va de una clase hacia una interfaz.')
    }
    if (to !== 'interface') {
      return deny('La realización apunta a una interfaz.')
    }
    return OK
  }

  switch (kind) {
    case 'association':
      if (isClassifierKind(from) && isClassifierKind(to)) return OK
      if (!UML_ENDPOINTS.includes(from) || !UML_ENDPOINTS.includes(to)) {
        return deny(
          'Una asociación une un actor con un caso de uso, o dos clasificadores.',
        )
      }
      if (from === to) {
        return deny(
          from === 'actor'
            ? 'Una asociación no une dos actores. Para jerarquías de actores usá Generalización.'
            : 'Una asociación no une dos casos de uso. Usá «include», «extend» o Generalización.',
        )
      }
      return OK

    case 'include':
      if (selfLink) return deny('Un caso de uso no puede incluirse a sí mismo.')
      if (from !== 'useCase' || to !== 'useCase') {
        return deny('«include» va de un caso de uso base a otro caso de uso incluido.')
      }
      return OK

    case 'extend':
      if (selfLink) return deny('Un caso de uso no puede extenderse a sí mismo.')
      if (from !== 'useCase' || to !== 'useCase') {
        return deny(
          '«extend» va del caso de uso que extiende hacia el caso de uso base.',
        )
      }
      return OK

    case 'generalization':
      if (selfLink) return deny('Un elemento no puede generalizar a sí mismo.')
      if (from !== to) {
        return deny(
          isClassifierKind(from) || isClassifierKind(to)
            ? 'La generalización une clasificadores del mismo tipo. Para que una clase implemente una interfaz usá Realización.'
            : 'La generalización une elementos del mismo tipo: actor con actor, o caso de uso con caso de uso.',
        )
      }
      if (from !== 'actor' && from !== 'useCase' && !isClassifierKind(from)) {
        return deny(
          `Una relación ${EDGE_SPECS[kind].title} sólo une actores, casos de uso o clasificadores.`,
        )
      }
      return OK
  }
}

/**
 * UML associations are undirected, so an actor drawn as the target is fine —
 * we just store it consistently as actor -> use case. Every other kind is
 * genuinely directed and is left alone.
 */
export function orientConnection(
  kind: UmlEdgeKind,
  source: UmlNode,
  target: UmlNode,
): { source: UmlNode; target: UmlNode } {
  if (kind === 'association' && nodeKindOf(source) === 'useCase') {
    return { source: target, target: source }
  }
  if (kind === 'noteLink' && nodeKindOf(target) === 'note') {
    return { source: target, target: source }
  }
  return { source, target }
}

/** Short hint shown under the palette while a connector kind is armed. */
export const CONNECTION_HINTS: Record<UmlEdgeKind, string> = {
  association: 'Arrastrá de un actor a un caso de uso, o entre dos clases.',
  include: 'Arrastrá del caso base al caso incluido.',
  extend: 'Arrastrá del caso que extiende al caso base.',
  generalization: 'Arrastrá del hijo al padre.',
  aggregation: 'Arrastrá del todo a la parte. El diamante hueco queda en el todo.',
  composition:
    'Arrastrá del compuesto a la parte. El diamante relleno queda en el compuesto.',
  dependency: 'Arrastrá del elemento que depende al que usa.',
  realization: 'Arrastrá de la clase a la interfaz que implementa.',
  noteLink: 'Arrastrá de una nota al elemento que anota.',
  arrow: 'Arrastrá entre dos elementos cualesquiera.',
}
