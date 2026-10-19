import { expect, test } from 'bun:test'
import { NODE_SPECS, type UmlNode, type UmlNodeKind } from '../types/uml'
import { canConnect } from './rules'

function node(kind: UmlNodeKind, id?: string): UmlNode {
  const spec = NODE_SPECS[kind]
  return {
    id: id ?? kind,
    type: kind,
    position: { x: 0, y: 0 },
    width: spec.width,
    height: spec.height,
    data: {
      label: spec.defaultLabel,
      fill: null,
      stroke: null,
      fontSize: 13,
      lineStyle: 'solid',
      z: spec.z,
      attributes: [],
      operations: [],
    },
  }
}

test('aggregation joins two classifiers from the whole to the part', () => {
  expect(canConnect('aggregation', node('class', 'a'), node('class', 'b')).ok).toBe(true)
  expect(canConnect('aggregation', node('class'), node('class')).ok).toBe(false)
  expect(canConnect('aggregation', node('class'), node('actor')).ok).toBe(false)
})

test('realization only goes from a class to an interface', () => {
  expect(canConnect('realization', node('class'), node('interface')).ok).toBe(true)
  expect(canConnect('realization', node('interface'), node('class')).ok).toBe(false)
  expect(canConnect('realization', node('class'), node('class', 'other')).ok).toBe(false)
})

test('class generalization stays within the same classifier kind', () => {
  expect(canConnect('generalization', node('class', 'a'), node('class', 'b')).ok).toBe(
    true,
  )
  expect(canConnect('generalization', node('class'), node('interface')).ok).toBe(false)
})

test('use-case association still rejects two actors', () => {
  expect(canConnect('association', node('actor', 'a'), node('actor', 'b')).ok).toBe(false)
  expect(canConnect('association', node('actor'), node('useCase')).ok).toBe(true)
  expect(canConnect('association', node('class', 'a'), node('class', 'b')).ok).toBe(true)
})
