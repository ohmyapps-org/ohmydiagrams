import { expect, test } from 'bun:test'
import { nodeKindOf } from '../types/uml'
import { validate } from '../uml/validation'
import { layoutPlanilla, parsePlanilla, sliceByActor, sliceForActor } from './index'

const SPEC = `# Modelo

## 1. Actores

| Actor | Generaliza a | Descripción |
|---|---|---|
| Solicitante | — | Reporta. |
| Técnico | Solicitante | Resuelve. |
| Reloj | — | Actor temporal. |

## 2. Casos de uso por actor

| Actor | Casos de uso propios | Hereda |
|---|---|---|
| Solicitante | CU-03 Reportar incidencia · CU-05 Solicitar préstamo | Ninguno |
| Técnico | CU-11 Tomar incidencia · CU-13 Resolver incidencia | Los del Solicitante |
| Reloj | CU-26 Vencer préstamo | Ninguno |

### 2.1 Relaciones include

| Caso incluido | Incluido por | Motivo |
|---|---|---|
| CU-N Notificar acuse | CU-03 | Acuse obligatorio. |
| CU-R Registrar en auditoría | CU-13 | Toda escritura deja traza. |

### 2.2 Relaciones extend

| Caso extensor | Extiende a | Punto de extensión | Condición |
|---|---|---|---|
| CU-21 Reasignar incidencia | CU-11 Tomar incidencia | Tras asignar | El admin reasigna |
`

test('a slice keeps only the cases that actor starts', () => {
  const slice = sliceForActor(parsePlanilla(SPEC), 'Solicitante')
  expect(slice.useCases.map((useCase) => useCase.code).sort()).toEqual([
    'CU-03',
    'CU-05',
    'CU-N',
  ])
})

test('an included case travels with the case that includes it', () => {
  const slice = sliceForActor(parsePlanilla(SPEC), 'Técnico')
  // CU-R rides along on CU-13.
  expect(slice.useCases.map((useCase) => useCase.code)).toContain('CU-R')
  expect(slice.relations).toContainEqual(
    expect.objectContaining({ kind: 'include', from: 'CU-13', to: 'CU-R' }),
  )
})

test('an extension travels with the case it extends', () => {
  const slice = sliceForActor(parsePlanilla(SPEC), 'Técnico')
  expect(slice.useCases.map((useCase) => useCase.code)).toContain('CU-21')
})

test('a shared factored case does not drag in the other actor that includes it', () => {
  // CU-N is included only by CU-03, so Técnico must not inherit it sideways.
  const slice = sliceForActor(parsePlanilla(SPEC), 'Técnico')
  expect(slice.useCases.map((useCase) => useCase.code)).not.toContain('CU-N')
  expect(slice.useCases.map((useCase) => useCase.code)).not.toContain('CU-03')
})

test('an ancestor that starts none of the shown cases is left out', () => {
  const slice = sliceForActor(parsePlanilla(SPEC), 'Técnico')
  // Solicitante would otherwise sit there with no association at all, which
  // rule 14 reads as a generalization pointing the wrong way.
  expect(slice.actors.map((actor) => actor.name)).not.toContain('Solicitante')
})

test('the caption records the inheritance the diagram does not draw', () => {
  const slice = sliceForActor(parsePlanilla(SPEC), 'Técnico')
  expect(slice.description).toContain('Solicitante')
})

test('a slice never invents a relationship the model does not have', () => {
  const model = parsePlanilla(SPEC)
  const all = new Set(model.relations.map((r) => `${r.kind}:${r.from}->${r.to}`))
  for (const { model: slice } of sliceByActor(model)) {
    for (const relation of slice.relations) {
      expect(all.has(`${relation.kind}:${relation.from}->${relation.to}`)).toBe(true)
    }
  }
})

test('every slice lays out with its actors outside the boundary', () => {
  for (const { model: slice } of sliceByActor(parsePlanilla(SPEC))) {
    const document = layoutPlanilla(slice)
    const actors = document.nodes.filter((node) => nodeKindOf(node) === 'actor')
    expect(actors.length).toBeGreaterThan(0)
    for (const actor of actors) expect(actor.position.x).toBeLessThan(0)
  }
})

test('a slice with no factored cases passes the whole checklist', () => {
  const slice = sliceForActor(parsePlanilla(SPEC), 'Reloj')
  const document = layoutPlanilla(slice)
  const report = validate(document.nodes, document.edges, document.meta)
  expect(report.items.filter((item) => item.status === 'fail')).toEqual([])
})

test('asking for an actor the model does not declare yields nothing to draw', () => {
  const slice = sliceForActor(parsePlanilla(SPEC), 'Inexistente')
  expect(slice.useCases).toEqual([])
  expect(slice.actors).toEqual([])
})
