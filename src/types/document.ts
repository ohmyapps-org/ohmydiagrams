/**
 * Identity of a saved document, shared by the library, the editor and the
 * export format. The diagram *kind* decides the palette, the checklist and the
 * guide; everything else in the editor is kind-agnostic.
 */

export type DiagramKind = 'useCase' | 'flow' | 'qa' | 'automation'

export const DIAGRAM_KINDS: readonly DiagramKind[] = [
  'useCase',
  'flow',
  'qa',
  'automation',
]

export function isDiagramKind(value: unknown): value is DiagramKind {
  return (
    typeof value === 'string' && DIAGRAM_KINDS.includes(value as DiagramKind)
  )
}

/** What the home view lists, without loading a single node. */
export interface LibraryEntry {
  id: string
  kind: DiagramKind
  title: string
  createdAt: number
  updatedAt: number
  nodeCount: number
  edgeCount: number
}

/** An imported requirements file, kept so it can be read again later. */
export interface SpecEntry {
  id: string
  name: string
  importedAt: number
  /** Characters in the extracted text, shown as the size of the file. */
  length: number
  /** Empty when the text was too large to keep in `localStorage`. */
  text: string
}
