import { expect, test } from 'bun:test'
import { NODE_SPECS, type UmlNode, type UmlNodeKind } from '../types/uml'
import { validate } from './validation'

const META = { title: 'Sistema de Punto de Venta', description: '' }

function node(kind: UmlNodeKind, label: string, x = 0, y = 0): UmlNode {
  const spec = NODE_SPECS[kind]
  return {
    id: `${kind}_${label}`,
    type: kind,
    position: { x, y },
    width: spec.width,
    height: spec.height,
    data: {
      label,
      fill: null,
      stroke: null,
      fontSize: 14,
      lineStyle: 'solid',
      z: spec.z,
      attributes: [],
      operations: [],
    },
  }
}

test('a blank canvas breaks no rule', () => {
  const report = validate([], [], { title: '', description: '' })
  expect(report.blank).toBe(true)
  expect(report.passed).toBe(0)
  expect(report.items).not.toBeEmpty()
  expect(report.items.every((item) => item.status === 'idle')).toBe(true)
  expect(report.items.every((item) => item.message === '')).toBe(true)
  expect(report.items.flatMap((item) => item.fixes)).toEqual([])
})

test('the first element switches the checklist on', () => {
  const report = validate([node('actor', 'Cajero')], [], META)
  expect(report.blank).toBe(false)
  expect(report.items.some((item) => item.status === 'fail')).toBe(true)
  expect(report.items.every((item) => item.status !== 'idle')).toBe(true)
})
