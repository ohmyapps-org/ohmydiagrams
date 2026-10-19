import { create } from 'zustand'
import { pickFile } from '../export/download'
import { coerceDocument } from '../export/json'
import { REQUIREMENTS_ACCEPT, readRequirementsFile } from '../requirements/read'
import type { DiagramKind, LibraryEntry, SpecEntry } from '../types/document'
import { isDiagramKind } from '../types/document'
import type { UmlDocument } from '../types/uml'
import { emptyDocument, nextId, useDocument, type UiState } from './document'
import { createDebouncedStorage } from './storage'
import { toast } from './toasts'

const INDEX_KEY = 'ohmydiagrams:library:v1'
/** Key of the single document the app kept before the library existed. */
const LEGACY_KEY = 'ohmydiagrams:document:v1'
const AUTOSAVE_DELAY_MS = 500
/** A spec this long already costs ~1% of the localStorage budget. */
const MAX_SPEC_CHARS = 400_000

const storage = createDebouncedStorage(AUTOSAVE_DELAY_MS)

const docKey = (id: string): string => `ohmydiagrams:doc:${id}`

/** What a document file holds on top of the exportable diagram. */
interface StoredDocument {
  doc: UmlDocument
  ui: Partial<UiState>
}

interface Index {
  entries: LibraryEntry[]
  specs: SpecEntry[]
  activeId: string | null
}

const EMPTY_INDEX: Index = { entries: [], specs: [], activeId: null }

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

function readIndex(): Index {
  const raw = storage.getItem(INDEX_KEY)
  if (typeof raw !== 'string') return EMPTY_INDEX
  try {
    const parsed = JSON.parse(raw) as Partial<Index>
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(
          (entry): entry is LibraryEntry =>
            typeof entry?.id === 'string' && isDiagramKind(entry.kind),
        )
      : []
    const specs = Array.isArray(parsed.specs)
      ? parsed.specs.filter(
          (spec): spec is SpecEntry =>
            typeof spec?.id === 'string' && typeof spec.name === 'string',
        )
      : []
    const activeId =
      typeof parsed.activeId === 'string' &&
      entries.some((entry) => entry.id === parsed.activeId)
        ? parsed.activeId
        : null
    return { entries, specs, activeId }
  } catch {
    return EMPTY_INDEX
  }
}

function writeIndex(index: Index): void {
  storage.setItem(INDEX_KEY, JSON.stringify(index))
}

function writeDoc(id: string, doc: UmlDocument, ui: Partial<UiState>): void {
  storage.setItem(docKey(id), JSON.stringify({ doc, ui } satisfies StoredDocument))
}

function readDoc(id: string): StoredDocument | null {
  const raw = storage.getItem(docKey(id))
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDocument>
    // The document goes through the same validation as an imported file.
    return {
      doc: coerceDocument(parsed.doc),
      ui: typeof parsed.ui === 'object' && parsed.ui !== null ? parsed.ui : {},
    }
  } catch {
    return null
  }
}

function countLines(source: string | undefined): number {
  const text = source?.trim() ?? ''
  return text === '' ? 0 : text.split(/\r?\n/).length
}

function entryOf(id: string, doc: UmlDocument, created: number): LibraryEntry {
  return {
    id,
    kind: doc.kind,
    title: doc.meta.title,
    createdAt: created,
    updatedAt: Date.now(),
    nodeCount: doc.nodes.length,
    edgeCount: doc.edges.length,
    ...(doc.kind === 'text' ? { lineCount: countLines(doc.source) } : {}),
  }
}

/**
 * The one document saved before the library existed becomes its first entry,
 * so nobody loses the diagram they had open when they update the app.
 */
function migrateLegacy(): Index | null {
  const raw = storage.getItem(LEGACY_KEY)
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as { state?: { ui?: Partial<UiState> } }
    const doc = coerceDocument(parsed.state)
    const id = nextId('doc')
    writeDoc(id, doc, parsed.state?.ui ?? {})
    storage.removeItem(LEGACY_KEY)
    const index: Index = {
      entries: [entryOf(id, doc, Date.now())],
      specs: [],
      activeId: doc.nodes.length > 0 ? id : null,
    }
    // Written here and not on the first edit: a reload right after the update
    // would otherwise leave the migrated document with no entry pointing at it.
    writeIndex(index)
    return index
  } catch {
    storage.removeItem(LEGACY_KEY)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

interface LibraryState {
  entries: LibraryEntry[]
  specs: SpecEntry[]
  /** `null` means the home view: no document is open. */
  activeId: string | null
  /** True while a picked file is being read, which for a PDF takes a while. */
  importingSpec: boolean

  createDiagram: (kind: DiagramKind) => void
  openDiagram: (id: string) => void
  /** Saves and goes back to the home view. */
  closeDiagram: () => void
  duplicateDiagram: (id: string) => void
  deleteDiagram: (id: string) => void
  /** Adds an imported or dropped file as a new document, and opens it. */
  importDocument: (doc: UmlDocument) => void

  addSpec: (name: string, text: string) => void
  /** Reads a requirements file and keeps it, without extracting anything. */
  importSpecFromPicker: () => Promise<void>
  removeSpec: (id: string) => void
}

function bootstrap(): Index {
  const index = readIndex()
  return index.entries.length > 0 ? index : (migrateLegacy() ?? index)
}

const initial = bootstrap()

export const useLibrary = create<LibraryState>((set, get) => {
  /** Writes the index after any change to entries, specs or the open document. */
  const persistIndex = (): void => {
    const { entries, specs, activeId } = get()
    writeIndex({ entries, specs, activeId })
  }

  // Order matters: the autosave subscription writes to whatever `activeId`
  // says, so it has to point at the incoming document before it arrives.
  const open = (id: string, stored: StoredDocument): void => {
    set({ activeId: id })
    useDocument.getState().loadDocument(stored.doc, stored.ui)
    persistIndex()
  }

  return {
    entries: initial.entries,
    specs: initial.specs,
    activeId: initial.activeId,
    importingSpec: false,

    createDiagram: (kind) => {
      const id = nextId('doc')
      const doc = emptyDocument(kind)
      writeDoc(id, doc, {})
      set((state) => ({ entries: [entryOf(id, doc, Date.now()), ...state.entries] }))
      open(id, { doc, ui: {} })
    },

    openDiagram: (id) => {
      const stored = readDoc(id)
      // A document that cannot be read is a document that no longer exists.
      if (!stored) {
        get().deleteDiagram(id)
        return
      }
      open(id, stored)
    },

    closeDiagram: () => {
      saveActive()
      set({ activeId: null })
      persistIndex()
    },

    duplicateDiagram: (id) => {
      const stored = id === get().activeId ? currentStored() : readDoc(id)
      if (!stored) return
      const copy: UmlDocument = {
        ...stored.doc,
        meta: { ...stored.doc.meta, title: `${stored.doc.meta.title || 'Sin título'} (copia)` },
      }
      const newId = nextId('doc')
      writeDoc(newId, copy, stored.ui)
      set((state) => ({
        entries: [entryOf(newId, copy, Date.now()), ...state.entries],
      }))
      persistIndex()
    },

    deleteDiagram: (id) => {
      storage.removeItem(docKey(id))
      set((state) => ({
        entries: state.entries.filter((entry) => entry.id !== id),
        activeId: state.activeId === id ? null : state.activeId,
      }))
      persistIndex()
    },

    importDocument: (doc) => {
      const id = nextId('doc')
      writeDoc(id, doc, {})
      set((state) => ({ entries: [entryOf(id, doc, Date.now()), ...state.entries] }))
      open(id, { doc, ui: {} })
    },

    addSpec: (name, text) => {
      const spec: SpecEntry = {
        id: nextId('spec'),
        name,
        importedAt: Date.now(),
        length: text.length,
        text: text.length > MAX_SPEC_CHARS ? '' : text,
      }
      set((state) => ({
        // One entry per file name: re-importing replaces the old reading.
        specs: [spec, ...state.specs.filter((item) => item.name !== name)],
      }))
      persistIndex()
    },

    importSpecFromPicker: async () => {
      const file = await pickFile(REQUIREMENTS_ACCEPT)
      if (!file) return
      set({ importingSpec: true })
      try {
        get().addSpec(file.name, await readRequirementsFile(file))
        toast.success(`"${file.name}" guardado en tus requisitos.`)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'No se pudo leer el archivo.',
        )
      } finally {
        set({ importingSpec: false })
      }
    },

    removeSpec: (id) => {
      set((state) => ({ specs: state.specs.filter((spec) => spec.id !== id) }))
      persistIndex()
    },
  }
})

/** The open document, in the shape the library stores. */
function currentStored(): StoredDocument {
  const state = useDocument.getState()
  return {
    doc: state.toDocument(),
    ui: {
      snapToGrid: state.ui.snapToGrid,
      showGrid: state.ui.showGrid,
      pendingEdgeKind: state.ui.pendingEdgeKind,
      guideChecks: state.ui.guideChecks,
    },
  }
}

function saveActive(): void {
  const { activeId, entries } = useLibrary.getState()
  if (!activeId) return
  const stored = currentStored()
  writeDoc(activeId, stored.doc, stored.ui)
  const next = entries.map((entry) =>
    entry.id === activeId
      ? {
          ...entry,
          title: stored.doc.meta.title,
          kind: stored.doc.kind,
          updatedAt: Date.now(),
          nodeCount: stored.doc.nodes.length,
          edgeCount: stored.doc.edges.length,
          ...(stored.doc.kind === 'text'
            ? { lineCount: countLines(stored.doc.source) }
            : {}),
        }
      : entry,
  )
  useLibrary.setState({ entries: next })
  writeIndex({ entries: next, specs: useLibrary.getState().specs, activeId })
}

// Autosave: every canvas edit lands in the open document's file. The writes
// are debounced inside `storage`, so a drag costs one save, not sixty.
useDocument.subscribe((state, previous) => {
  if (
    state.nodes === previous.nodes &&
    state.edges === previous.edges &&
    state.meta === previous.meta &&
    state.source === previous.source &&
    state.ui === previous.ui
  ) {
    return
  }
  saveActive()
})

// Restore the document that was open, so a refresh lands where you left off.
if (initial.activeId) {
  const stored = readDoc(initial.activeId)
  if (stored) useDocument.getState().loadDocument(stored.doc, stored.ui)
  else useLibrary.setState({ activeId: null })
}
