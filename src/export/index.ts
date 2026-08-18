import { useDocument } from '../store/document'
import { toast } from '../store/toasts'
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

export function exportSvg(): void {
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
    useDocument.getState().loadDocument(parseDocument(raw))
    toast.success('Diagrama cargado.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'No se pudo abrir el archivo.')
  }
}

export { documentToSvg, parseDocument, serializeDocument }
