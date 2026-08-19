/** What the file picker offers when importing requirements. */
export const REQUIREMENTS_ACCEPT = '.pdf,.md,.markdown,.txt,.text,text/plain,application/pdf'

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/**
 * pdf.js weighs about a megabyte, so it is only fetched when a PDF is actually
 * opened; Markdown and plain text never pay for it.
 */
async function readPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let page = 1; page <= document.numPages; page += 1) {
    const content = await (await document.getPage(page)).getTextContent()
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' '),
    )
  }
  return pages.join('\n')
}

export async function readRequirementsFile(file: File): Promise<string> {
  const text = isPdf(file) ? await readPdf(file) : await file.text()
  if (!text.trim()) throw new Error('El archivo no tiene texto legible.')
  return text
}
