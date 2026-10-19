import { expect, test } from 'bun:test'
import { createEdge } from '../store/document'
import { NODE_SPECS, type UmlNode, type UmlNodeKind } from '../types/uml'
import { validateClass } from './classValidation'
import { createClassSkeleton } from './templates'

const META = { title: 'Ventas', description: '' }

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
      fontSize: 13,
      lineStyle: 'solid',
      z: spec.z,
      attributes: [],
      operations: [],
    },
  }
}

function failed(report: ReturnType<typeof validateClass>, id: string): boolean {
  return report.items.some((item) => item.id === id && item.status === 'fail')
}

test('a blank canvas breaks no class rule', () => {
  const report = validateClass([], [], { title: '', description: '' })
  expect(report.blank).toBe(true)
  expect(report.total).toBe(12)
  expect(report.items.every((item) => item.status === 'idle')).toBe(true)
})

test('the first class switches the checklist on', () => {
  const report = validateClass([node('class', 'Cliente')], [], META)
  expect(report.blank).toBe(false)
  expect(report.items.every((item) => item.status !== 'idle')).toBe(true)
})

test('duplicate classifier names fail', () => {
  const report = validateClass(
    [node('class', 'Cliente'), node('interface', 'Cliente', 200, 0)],
    [],
    META,
  )
  expect(failed(report, 'unique-classifier-names')).toBe(true)
})

test('a lowercase class name offers a rename fix', () => {
  const report = validateClass([node('class', 'pedido')], [], META)
  const item = report.items.find((entry) => entry.id === 'classifier-names')
  expect(item?.status).toBe('fail')
  expect(item?.fixes[0]).toEqual({
    kind: 'renameNode',
    nodeId: 'class_pedido',
    value: 'Pedido',
    label: '"pedido" -> "Pedido"',
  })
})

test('an actor on a class diagram is foreign', () => {
  const report = validateClass(
    [node('class', 'Cliente'), node('actor', 'Cajero', 240, 0)],
    [],
    META,
  )
  expect(failed(report, 'no-foreign-elements')).toBe(true)
})

test('a composition cycle fails', () => {
  const whole = node('class', 'Pedido')
  const part = node('class', 'LineaPedido', 240, 0)
  const edges = [
    createEdge('composition', whole.id, part.id),
    createEdge('composition', part.id, whole.id),
  ]
  const report = validateClass([whole, part], edges, META)
  expect(failed(report, 'no-composition-cycles')).toBe(true)
})

test('realization from class to interface passes that rule', () => {
  const cls = node('class', 'Pedido')
  const iface = node('interface', 'Pagable', 240, 0)
  const edge = createEdge('realization', cls.id, iface.id)
  const report = validateClass([cls, iface], [edge], META)
  expect(failed(report, 'realization-direction')).toBe(false)
})

test('the class skeleton passes every rule except the title', () => {
  const fragment = createClassSkeleton({ x: 400, y: 300 })
  const report = validateClass(fragment.nodes, fragment.edges, {
    title: '',
    description: '',
  })
  const failing = report.items.filter((item) => item.status === 'fail')
  expect(failing.map((item) => item.id)).toEqual(['class-has-title'])
})

test('the class skeleton with a title is fully valid', () => {
  const fragment = createClassSkeleton({ x: 400, y: 300 })
  const report = validateClass(fragment.nodes, fragment.edges, META)
  expect(report.blank).toBe(false)
  expect(report.passed).toBe(report.total)
})
