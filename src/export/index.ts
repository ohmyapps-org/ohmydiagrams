import { useDocument } from '../store/document'
import { useLibrary } from '../store/library'
import { toast } from '../store/toasts'
import { describeFailure, renderMermaid } from '../text/mermaid'
import { downloadBlob, pickTextFile, slugify } from './download'
import { parseDocument, serializeDocument } from './json'
import { svgToPngBlob } from './png'
import { documentToSvg } from './svg'

function stem(): string {
  return slugify(useDocument.getState().meta.title)
}

export function exportJson(): void {
  const doc = useDocument.getState().toDocument()
  downloadBlob(
    new Blob([serializeDocument(doc)], { type: 'application/json' }),
    `${stem()}.json`,
  )
  toast.success('Diagrama guardado como JSON.')
}

/** The pele drawing of the open text diagram, or a toast saying why not. */
async function drawnText(): Promise<string | null> {
  const result = await renderMermaid(useDocument.getState().source)
  if (result.ok) return result.svg
  toast.error(
    result.code === 'empty' ? 'El diagrama está vacío.' : describeFailure(result),
  )
  return null
}

export function exportMermaid(): void {
  const { source } = useDocument.getState()
  if (source.trim() === '') {
    toast.error('El diagrama está vacío.')
    return
  }
  downloadBlob(new Blob([source], { type: 'text/vnd.mermaid' }), `${stem()}.mmd`)
  toast.success('Texto Mermaid guardado.')
}

async function exportTextSvg(): Promise<void> {
  const svg = await drawnText()
  if (!svg) return
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${stem()}.svg`)
  toast.success('SVG exportado.')
}

async function exportTextPng(scale: number): Promise<void> {
  const svg = await drawnText()
  if (!svg) return
  try {
    downloadBlob(await svgToPngBlob(svg, scale), `${stem()}@${scale}x.png`)
    toast.success(`PNG exportado a ${scale}x.`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Falló la exportación.')
  }
}

export function exportSvg(): void {
  if (useDocument.getState().kind === 'text') {
    void exportTextSvg()
    return
  }
  const doc = useDocument.getState().toDocument()
  if (doc.nodes.length === 0) {
    toast.error('El diagrama está vacío.')
    return
  }
  downloadBlob(
    new Blob([documentToSvg(doc)], { type: 'image/svg+xml' }),
    `${stem()}.svg`,
  )
  toast.success('SVG exportado.')
}

export async function exportPng(scale = 2): Promise<void> {
  if (useDocument.getState().kind === 'text') return exportTextPng(scale)
  const doc = useDocument.getState().toDocument()
  if (doc.nodes.length === 0) {
    toast.error('El diagrama está vacío.')
    return
  }
  try {
    const blob = await svgToPngBlob(documentToSvg(doc), scale)
    downloadBlob(blob, `${stem()}@${scale}x.png`)
    toast.success(`PNG exportado a ${scale}x.`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Falló la exportación.')
  }
}

export async function importJson(): Promise<void> {
  const raw = await pickTextFile('application/json,.json')
  if (raw === null) return
  try {
    // An imported file becomes a document of its own, not an overwrite of the
    // one already open.
    useLibrary.getState().importDocument(parseDocument(raw))
    toast.success('Diagrama cargado.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'No se pudo abrir el archivo.')
  }
}

export { documentToSvg, parseDocument, serializeDocument }
