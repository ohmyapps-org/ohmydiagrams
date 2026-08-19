import { expect, test } from 'bun:test'
import { coerceDocument, parseDocument, serializeDocument } from './json'

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
