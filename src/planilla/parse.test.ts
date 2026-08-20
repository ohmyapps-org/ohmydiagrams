import { expect, test } from 'bun:test'
import { serializeDocument } from '../export/json'
import { nodeKindOf } from '../types/uml'
import { contains, nodeRect } from '../uml/geometry'
import { validate } from '../uml/validation'
import { importPlanilla, parsePlanilla } from './index'

const CATALOGUE = `# Modelo de casos de uso

## 1. Actores

| Actor | Generaliza a | Descripción |
|---|---|---|
| Solicitante | — | Usa el equipamiento. |
| Técnico | Solicitante | Mantiene el equipamiento. |
| Reloj | — | Actor temporal. |

## 2. Casos de uso por actor

| Actor | Casos de uso propios | Hereda |
|---|---|---|
| Solicitante | CU-01 Iniciar sesion · CU-03 Reportar incidencia | Ninguno |
| Tecnico | CU-11 Tomar incidencia | Los del Solicitante |
| Reloj | CU-27 Expirar sesion | Ninguno |

### 2.1 Relaciones include

| Caso incluido | Incluido por | Motivo |
|---|---|---|
| CU-N Notificar acuse | CU-03 | El acuse es obligatorio. |

### 2.2 Relaciones extend

| Caso extensor | Extiende a | Punto de extensión | Condición |
|---|---|---|---|
| CU-21 Reasignar incidencia | CU-11 Tomar incidencia | Tras la asignación | El administrador reasigna |
`

test('the actor table yields actors with their generalization', () => {
  const model = parsePlanilla(CATALOGUE)
  expect(model.actors.map((actor) => actor.name)).toContain('Solicitante')
  const tecnico = model.actors.find((actor) => actor.name === 'Técnico')
  expect(tecnico?.generalizes).toBe('Solicitante')
  // An em dash in the cell means "no parent", not an actor called "—".
  expect(model.actors.find((actor) => actor.name === 'Solicitante')?.generalizes).toBeNull()
})

test('use cases are read with their code, name and owning actor', () => {
  const model = parsePlanilla(CATALOGUE)
  const reportar = model.useCases.find((useCase) => useCase.code === 'CU-03')
  expect(reportar?.name).toBe('Reportar incidencia')
  expect(reportar?.actor).toBe('Solicitante')
})

test('an actor spelled without accents still matches the actor table', () => {
  const model = parsePlanilla(CATALOGUE)
  // The second table says "Tecnico", the first says "Técnico": one actor, not two.
  expect(model.actors.filter((actor) => actor.name.startsWith('T'))).toHaveLength(1)
  expect(model.warnings.filter((w) => w.includes('planilla'))).toHaveLength(0)
})

test('«include» is stored from the base case to the included one', () => {
  const model = parsePlanilla(CATALOGUE)
  const include = model.relations.find((relation) => relation.kind === 'include')
  expect(include).toEqual(
    expect.objectContaining({ kind: 'include', from: 'CU-03', to: 'CU-N' }),
  )
})

test('«extend» is stored from the extending case to the base one', () => {
  const model = parsePlanilla(CATALOGUE)
  const extend = model.relations.find((relation) => relation.kind === 'extend')
  expect(extend).toEqual(
    expect.objectContaining({ kind: 'extend', from: 'CU-21', to: 'CU-11' }),
  )
})

const PLANILLAS = `# Especificación por planillas

### CU-03 Reportar incidencia

| Campo | Contenido |
|---|---|
| **Identificador** | CU-03 |
| **Actor principal** | Solicitante (y por generalización, todos los actores humanos) |
| **Objetivo** | Dejar registrada una incidencia |

**Flujo principal**

1. El actor describe el problema.
2. **include** CU-N: el sistema devuelve el identificador como acuse.

### CU-N Notificar acuse

| Campo | Contenido |
|---|---|
| **Identificador** | CU-N |
| **Objetivo** | Devolver constancia de recepción |
`

test('a file of planillas alone is enough to draw a diagram', () => {
  const { model, document } = importPlanilla(PLANILLAS)
  expect(model.useCases.map((useCase) => useCase.code).sort()).toEqual(['CU-03', 'CU-N'])
  expect(model.actors.map((actor) => actor.name)).toEqual(['Solicitante'])
  // The include comes from the flow step, not from a table.
  expect(model.relations).toEqual([
    expect.objectContaining({ kind: 'include', from: 'CU-03', to: 'CU-N' }),
  ])
  expect(document.nodes.filter((node) => nodeKindOf(node) === 'useCase')).toHaveLength(2)
})

test('the principal actor drops the parenthesis restating the hierarchy', () => {
  const model = parsePlanilla(PLANILLAS)
  expect(model.useCases.find((useCase) => useCase.code === 'CU-03')?.actor).toBe('Solicitante')
})

test('a planilla heading overrides the catalogue name', () => {
  // The catalogue writes "Iniciar sesion"; the planilla carries the accent.
  const model = parsePlanilla(`${CATALOGUE}\n### CU-01 Iniciar sesión\n\n| Campo | Contenido |\n|---|---|\n| **Actor principal** | Solicitante |\n`)
  expect(model.useCases.find((useCase) => useCase.code === 'CU-01')?.name).toBe('Iniciar sesión')
})

test('naming a case in the include table is enough to declare it', () => {
  // CU-N appears in no other table, and is still drawn.
  const model = parsePlanilla(CATALOGUE)
  const notificar = model.useCases.find((useCase) => useCase.code === 'CU-N')
  expect(notificar?.name).toBe('Notificar acuse')
  // Nobody invokes it directly: it exists only as the target of an «include».
  expect(notificar?.actor).toBeNull()
})

test('a relationship pointing at an undeclared code is dropped and reported', () => {
  const model = parsePlanilla(CATALOGUE.replace('| CU-03 | El acuse', '| CU-03, CU-77 | El acuse'))
  expect(model.relations.some((relation) => relation.from === 'CU-77')).toBe(false)
  expect(model.warnings.join(' ')).toContain('CU-77')
})

test('the layout opens inside the rules it can control', () => {
  const { document } = importPlanilla(CATALOGUE)
  const boundary = document.nodes.find((node) => nodeKindOf(node) === 'boundary')
  expect(boundary).toBeDefined()
  const box = nodeRect(boundary!)

  for (const node of document.nodes) {
    const kind = nodeKindOf(node)
    if (kind === 'useCase') expect(contains(box, nodeRect(node))).toBe(true)
    // Rule 6: actors are external to the system.
    if (kind === 'actor') expect(contains(box, nodeRect(node))).toBe(false)
  }
})

test('two actors on the same side never overlap', () => {
  const { document } = importPlanilla(CATALOGUE)
  const actors = document.nodes
    .filter((node) => nodeKindOf(node) === 'actor')
    .map(nodeRect)

  for (const a of actors) {
    for (const b of actors) {
      if (a === b || a.x !== b.x) continue
      const disjoint = a.y + a.height <= b.y || b.y + b.height <= a.y
      expect(disjoint).toBe(true)
    }
  }
})

test('the same Markdown always produces the same file', () => {
  const first = serializeDocument(importPlanilla(CATALOGUE).document)
  const second = serializeDocument(importPlanilla(CATALOGUE).document)
  expect(first).toBe(second)
})

test('a well formed specification passes the whole checklist', () => {
  const { document } = importPlanilla(`# Ventas

## 1. Actores

| Actor | Generaliza a | Descripción |
|---|---|---|
| Cajero | — | Atiende el mostrador. |

## 2. Casos de uso por actor

| Actor | Casos de uso propios | Hereda |
|---|---|---|
| Cajero | CU-01 Registrar venta · CU-02 Consultar stock | Ninguno |
`)
  const report = validate(document.nodes, document.edges, document.meta)
  const failing = report.items.filter((item) => item.status === 'fail')
  expect(failing.map((item) => item.number)).toEqual([])
})
