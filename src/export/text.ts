export const EXPORT_FONT_STACK =
  'ui-sans-serif, -apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

let context: CanvasRenderingContext2D | null | undefined

function measurer(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context
  context = document.createElement('canvas').getContext('2d')
  return context
}

/** Width of `text` at `fontSize`, measured with the real font when possible. */
export function measureText(text: string, fontSize: number, bold = false): number {
  const ctx = measurer()
  if (!ctx) return text.length * fontSize * 0.52
  ctx.font = `${bold ? '600 ' : ''}${fontSize}px ${EXPORT_FONT_STACK}`
  return ctx.measureText(text).width
}

/** Greedy word wrap that mirrors how the browser lays the label out on canvas. */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  bold = false,
): string[] {
  const paragraphs = text.split('\n')
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let current = words[0]!
    for (const word of words.slice(1)) {
      const candidate = `${current} ${word}`
      if (measureText(candidate, fontSize, bold) <= maxWidth) {
        current = candidate
      } else {
        lines.push(current)
        current = word
      }
    }
    lines.push(current)
  }

  return lines
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)
}
