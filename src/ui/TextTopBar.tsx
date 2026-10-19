import { ChevronLeft, FilePlus2, FolderOpen } from 'lucide-react'
import { diagramType } from '../diagrams/registry'
import { exportJson, exportMermaid, exportPng, exportSvg, importJson } from '../export'
import { useDocument } from '../store/document'
import { useLibrary } from '../store/library'
import ConnectionsMenu from './ConnectionsMenu'
import ThemeButton from './ThemeButton'
import { Divider, ExportMenu, ToolButton, type ExportItem } from './TopBar'

const TEXT_EXPORTS: readonly ExportItem[] = [
  { label: 'SVG (vectorial)', shortcut: '⇧⌘E', run: exportSvg },
  { label: 'PNG (2x)', shortcut: '⌘E', run: () => void exportPng(2) },
  { label: 'Texto Mermaid (.mmd)', shortcut: '⌘S', run: exportMermaid },
  { label: 'JSON del diagrama', shortcut: '', run: exportJson },
]

/** The top bar of a text diagram: no canvas tools, same identity and exports. */
export default function TextTopBar() {
  const title = useDocument((state) => state.meta.title)
  const setMeta = useDocument((state) => state.setMeta)
  const closeDiagram = useLibrary((state) => state.closeDiagram)
  const createDiagram = useLibrary((state) => state.createDiagram)
  const type = diagramType('text')

  return (
    <header className="glass relative z-30 flex h-14 shrink-0 items-center gap-1 rounded-panel px-3">
      <button
        type="button"
        onClick={closeDiagram}
        title="Volver a tus diagramas"
        className="flex h-8 items-center gap-1.5 rounded-control pl-1 pr-2.5 text-[13px] font-semibold tracking-tight text-ink transition hover:bg-accent-soft"
      >
        <ChevronLeft size={16} className="text-faint" />
        Oh My Diagrams
      </button>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
        <type.icon size={11} />
        {type.title}
      </span>

      <Divider />

      <input
        value={title}
        onChange={(event) => setMeta({ title: event.target.value })}
        placeholder="Título del diagrama"
        aria-label="Título del diagrama"
        data-diagram-title
        className="h-8 min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 text-[13px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-faint hover:border-line focus:border-accent"
      />

      <Divider />

      <ToolButton
        icon={<FilePlus2 size={16} />}
        label="Nuevo diagrama de texto"
        onClick={() => createDiagram('text')}
      />
      <ToolButton
        icon={<FolderOpen size={16} />}
        label="Abrir JSON"
        onClick={() => void importJson()}
      />

      <Divider />

      <ThemeButton />
      <ConnectionsMenu />
      <ExportMenu items={TEXT_EXPORTS} />
    </header>
  )
}
