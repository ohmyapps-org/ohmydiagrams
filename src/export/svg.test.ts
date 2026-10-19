import { expect, test } from 'bun:test'
import { createClassSkeleton } from '../uml/templates'
import { documentToSvg } from './svg'

test('a class diagram SVG draws compartments, members and a composition diamond', () => {
  const fragment = createClassSkeleton({ x: 400, y: 300 })
  const svg = documentToSvg({
    version: 1,
    kind: 'class',
    meta: { title: 'Ventas', description: '' },
    nodes: fragment.nodes,
    edges: fragment.edges,
  })

  expect(svg).toContain('Cliente')
  expect(svg).toContain('-nombre: String')
  expect(svg).toContain('+confirmar(): void')
  expect(svg).toContain('LineaPedido')
  expect(svg).toContain('uml-marker-diamondFilled-default')
  expect(svg).toContain('marker-start=')
})
