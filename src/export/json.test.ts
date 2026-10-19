import { expect, test } from 'bun:test'
import {
  MAX_SOURCE_CHARS,
  coerceDocument,
  parseDocument,
  serializeDocument,
} from './json'

const NODE = {
  id: 'actor_1',
  type: 'actor',
  position: { x: 0, y: 0 },
  data: { label: 'Cajero' },
}

test('a file saved before kinds existed loads as a use case diagram', () => {
  const doc = coerceDocument({ version: 1, meta: {}, nodes: [NODE], edges: [] })
  expect(doc.kind).toBe('useCase')
})

test('an unknown kind falls back instead of loading a broken document', () => {
  const doc = coerceDocument({ kind: 'mermaid', meta: {}, nodes: [], edges: [] })
  expect(doc.kind).toBe('useCase')
})

test('the kind survives a save and load round trip', () => {
  const doc = coerceDocument({ kind: 'flow', meta: { title: 'Alta' }, nodes: [], edges: [] })
  const reloaded = parseDocument(serializeDocument(doc))
  expect(reloaded.kind).toBe('flow')
  expect(reloaded.meta.title).toBe('Alta')
})

test('a file with no diagram in it is rejected', () => {
  expect(() => parseDocument('{"hola":1}')).toThrow()
  expect(() => parseDocument('no json')).toThrow()
})

test('a class diagram keeps its kind and compartments', () => {
  const doc = coerceDocument({
    kind: 'class',
    meta: { title: 'Dominio' },
    nodes: [
      {
        id: 'class_1',
        type: 'class',
        position: { x: 0, y: 0 },
        data: {
          label: 'Cliente',
          attributes: ['-nombre: String'],
          operations: ['+registrar(): void'],
        },
      },
    ],
    edges: [],
  })
  expect(doc.kind).toBe('class')
  expect(doc.nodes[0]!.data.attributes).toEqual(['-nombre: String'])
  const reloaded = parseDocument(serializeDocument(doc))
  expect(reloaded.kind).toBe('class')
  expect(reloaded.nodes[0]!.data.operations).toEqual(['+registrar(): void'])
})

test('a text diagram keeps its Mermaid source through a save and load', () => {
  const source = 'flowchart LR\n  A --> B\n'
  const doc = coerceDocument({
    kind: 'text',
    meta: { title: 'Flujo' },
    source,
    nodes: [],
    edges: [],
  })
  const reloaded = parseDocument(serializeDocument(doc))
  expect(reloaded.kind).toBe('text')
  expect(reloaded.source).toBe(source)
})

test('only a text diagram carries source, and a hostile one is capped', () => {
  const drawn = coerceDocument({
    kind: 'class',
    source: 'flowchart LR',
    meta: {},
    nodes: [],
    edges: [],
  })
  expect(drawn.source).toBeUndefined()
  const huge = coerceDocument({
    kind: 'text',
    source: 'x'.repeat(MAX_SOURCE_CHARS + 50),
    meta: {},
    nodes: [],
    edges: [],
  })
  expect(huge.source?.length).toBe(MAX_SOURCE_CHARS)
})
