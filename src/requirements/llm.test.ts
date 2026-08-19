import { afterEach, expect, test } from 'bun:test'
import type { LlmConfig } from '../llm/types'
import { createLlmExtractor } from './llm'

const CONFIG: LlmConfig = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: '',
  model: 'llama3.1',
}

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function stub(build: () => Response): void {
  globalThis.fetch = Object.assign(() => Promise.resolve(build()), {
    preconnect: realFetch.preconnect,
  })
}

/** Stands in for the server, answering with whatever the model "wrote". */
function reply(content: string): void {
  stub(
    () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

test('reads candidates out of a fenced json answer', async () => {
  reply(`Claro, acá van:
\`\`\`json
[
  {"name": "Registrar venta", "actor": "Vendedor", "source": "El sistema debe permitir registrar ventas."},
  {"name": "Consultar stock", "actor": "sistema", "source": "Se podrá consultar el stock."}
]
\`\`\``)

  const candidates = await createLlmExtractor(CONFIG).extract('spec')
  expect(candidates.map((item) => item.name)).toEqual([
    'Registrar venta',
    'Consultar stock',
  ])
  expect(candidates[0]?.actor).toBe('Vendedor')
  expect(candidates[0]?.compliant).toBe(true)
  // "sistema" is the subject of every requirement, never an actor.
  expect(candidates[1]?.actor).toBeNull()
})

test('drops duplicates and entries without a usable name', async () => {
  reply('[{"name":"Registrar venta"},{"name":"registrar  venta"},{"name":"x"}]')

  const candidates = await createLlmExtractor(CONFIG).extract('spec')
  expect(candidates).toHaveLength(1)
  expect(candidates[0]?.source).toBe('Registrar venta')
})

test('accepts an empty list as a real answer', async () => {
  reply('[]')
  expect(await createLlmExtractor(CONFIG).extract('spec')).toEqual([])
})

test('fails loudly when the answer holds no list', async () => {
  reply('No encontré requisitos funcionales en el documento.')
  expect(createLlmExtractor(CONFIG).extract('spec')).rejects.toThrow(
    'no devolvió una lista',
  )
})

test('surfaces the server error instead of an empty list', async () => {
  stub(
    () =>
      new Response(JSON.stringify({ error: { message: 'model not found' } }), {
        status: 404,
      }),
  )

  expect(createLlmExtractor(CONFIG).extract('spec')).rejects.toThrow('model not found')
})
