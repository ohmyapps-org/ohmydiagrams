import { expect, test } from 'bun:test'
import { chatEndpoint } from './client'

test('completes a bare host into the chat-completions route', () => {
  expect(chatEndpoint('http://localhost:11434')).toBe(
    'http://localhost:11434/v1/chat/completions',
  )
})

test('keeps an explicit api version', () => {
  expect(chatEndpoint('https://api.openai.com/v1')).toBe(
    'https://api.openai.com/v1/chat/completions',
  )
})

test('accepts the full route and a trailing slash', () => {
  expect(chatEndpoint('https://mi-vps.com/v1/chat/completions')).toBe(
    'https://mi-vps.com/v1/chat/completions',
  )
  expect(chatEndpoint('  https://mi-vps.com/v1/  ')).toBe(
    'https://mi-vps.com/v1/chat/completions',
  )
})
