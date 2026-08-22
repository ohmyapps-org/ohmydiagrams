/**
 * The worker is asked for by URL rather than built by Vite's `new Worker`
 * wrapper because pdf.js insists on instantiating it itself. Going through
 * `?worker&url` instead of `new URL('...pdf.worker.min.mjs', import.meta.url)`
 * is what keeps the emitted file named `.js`: nginx's stock mime.types has no
 * entry for `.mjs`, so it served the copied-through worker as
 * `application/octet-stream`, and a `type: 'module'` worker refuses anything
 * that is not a JavaScript MIME type. That refusal is silent -- pdf.js falls
 * back to importing the same URL on the main thread, which the MIME check
 * rejects a second time -- so every PDF failed to open in production while
 * working locally, where Vite serves `.mjs` correctly.
 */
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url'

/** What the file picker offers when importing requirements. */
export const REQUIREMENTS_ACCEPT = '.pdf,.md,.markdown,.txt,.text,text/plain,application/pdf'

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/**
 * Every deploy renames the hashed chunks, so a tab opened before it still asks
 * for the `pdf-<old hash>.js` it was built against, and that file is gone. The
 * static host answers the miss with the SPA fallback -- index.html, 200,
 * `text/html` -- and the browser refuses to run HTML as a module, which is the
 * "error loading dynamically imported module" the user sees.
 *
 * Retrying is pointless: the chunk this tab wants no longer exists on the
 * server. Only loading the new index.html fixes it, so say that instead of
 * leaking the browser's message.
 */
async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  try {
    return await import('pdfjs-dist')
  } catch {
    throw new Error(
      'Se publicó una versión nueva de la app. Recargá la página e importá el PDF de nuevo.',
    )
  }
}

/**
 * pdf.js weighs about a megabyte, so it is only fetched when a PDF is actually
 * opened; Markdown and plain text never pay for it.
 */
async function readPdf(file: File): Promise<string> {
  const pdfjs = await loadPdfjs()
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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
