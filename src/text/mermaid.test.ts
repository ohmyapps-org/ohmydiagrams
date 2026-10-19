import { expect, test } from 'bun:test'
import { describeFailure, MERMAID_EXAMPLES, renderMermaid } from './mermaid'

test('every bundled example draws', async () => {
  for (const example of MERMAID_EXAMPLES) {
    const result = await renderMermaid(example.source)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.svg.startsWith('<svg')).toBe(true)
  }
})

test('a blank source is empty, not an error', async () => {
  const result = await renderMermaid('  \n ')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.code).toBe('empty')
})

test('a syntax error says where it is', async () => {
  const result = await renderMermaid('flowchart LR\n  A --> ')
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.code).toBe('syntax')
    expect(result.line).toBeGreaterThan(0)
    expect(describeFailure(result)).toContain(`Línea ${result.line}`)
  }
})

test('text that is no diagram at all is reported as unsupported', async () => {
  const result = await renderMermaid('hola mundo')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.code).toBe('unsupported-diagram')
})

test('diagram text is escaped in the drawing', async () => {
  const result = await renderMermaid(
    'flowchart LR\n  A["<script>alert(1)</script>"] --> B',
  )
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.svg).not.toContain('<script')
})
