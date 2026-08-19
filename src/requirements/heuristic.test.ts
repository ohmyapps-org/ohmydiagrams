import { expect, test } from 'bun:test'
import { heuristicExtractor } from './heuristic'

const SPEC = `
Especificación de requisitos del Sistema de Punto de Venta.
Este párrafo es introductorio y no describe ninguna capacidad.

RF-01: El sistema debe permitir registrar ventas de manera rápida.
RF-02: El sistema deberá emitir comprobantes fiscales para cada venta.
- El cliente podrá consultar el stock disponible desde la tienda web.
- El sistema debe poder generar reportes mensuales y exportarlos a PDF.
Como administrador quiero gestionar usuarios para controlar los accesos.
El cajero tiene que registrar el pago del cliente.
`

test('reads one use case per capability sentence', async () => {
  const names = (await heuristicExtractor.extract(SPEC)).map((item) => item.name)
  expect(names).toEqual([
    'Registrar ventas',
    'Emitir comprobantes fiscales',
    'Consultar stock disponible',
    'Generar reportes mensuales',
    'Gestionar usuarios',
    'Registrar pago',
  ])
})

test('ignores prose that states no capability', async () => {
  const result = await heuristicExtractor.extract(
    'El presente documento describe el alcance del proyecto y sus antecedentes.',
  )
  expect(result).toEqual([])
})

test('keeps the actor the sentence names, and only when it is one', async () => {
  const result = await heuristicExtractor.extract(SPEC)
  const byName = new Map(result.map((item) => [item.name, item.actor]))
  expect(byName.get('Consultar stock disponible')).toBe('Cliente')
  expect(byName.get('Registrar pago')).toBe('Cajero')
  // "El sistema debe..." names the system, which is not an actor.
  expect(byName.get('Registrar ventas')).toBeNull()
})

test('marks a name that is not "infinitive + object" instead of rewriting it', async () => {
  const result = await heuristicExtractor.extract(
    'El sistema debe permitir la anulación de una venta.',
  )
  expect(result[0]?.name).toBe('Anulación')
  expect(result[0]?.compliant).toBe(false)
})

test('drops repeated capabilities', async () => {
  const result = await heuristicExtractor.extract(`
    El sistema debe permitir registrar ventas.
    El sistema deberá registrar ventas desde la caja.
  `)
  expect(result).toHaveLength(1)
})

test('keeps the source sentence for traceability', async () => {
  const result = await heuristicExtractor.extract('RF-09: El sistema debe emitir facturas.')
  expect(result[0]?.source).toBe('El sistema debe emitir facturas.')
})
