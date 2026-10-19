import { useReactFlow } from '@xyflow/react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ChevronDown,
  ChevronLeft,
  Download,
  FilePlus2,
  FolderOpen,
  Grid3x3,
  Maximize,
  Maximize2,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import MenuShell from '../canvas/MenuShell'
import { diagramType } from '../diagrams/registry'
import { exportJson, exportPng, exportSvg, importJson } from '../export'
import { useDocument } from '../store/document'
import { useLibrary } from '../store/library'
import { useView } from '../store/view'
import type { AlignAxis } from '../uml/geometry'
import ConnectionsMenu from './ConnectionsMenu'
import ThemeButton from './ThemeButton'

export function ToolButton({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-control transition disabled:opacity-30 ${
        active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-accent-soft'
      }`}
    >
      {icon}
    </button>
  )
}

export function Divider() {
  return <div className="mx-1 h-5 w-px bg-line" />
}

const ALIGN_BUTTONS: readonly { axis: AlignAxis; label: string; icon: ReactNode }[] = [
  { axis: 'left', label: 'Alinear a la izquierda', icon: <AlignStartVertical size={16} /> },
  { axis: 'centerX', label: 'Centrar horizontalmente', icon: <AlignCenterVertical size={16} /> },
  { axis: 'right', label: 'Alinear a la derecha', icon: <AlignEndVertical size={16} /> },
  { axis: 'top', label: 'Alinear arriba', icon: <AlignStartHorizontal size={16} /> },
  { axis: 'centerY', label: 'Centrar verticalmente', icon: <AlignCenterHorizontal size={16} /> },
  { axis: 'bottom', label: 'Alinear abajo', icon: <AlignEndHorizontal size={16} /> },
]

/** Matches the `w-52` the menu renders at, for right-edge alignment. */
const EXPORT_MENU_WIDTH_PX = 13 * 16

export interface ExportItem {
  label: string
  shortcut: string
  run: () => void
}

const DRAWN_EXPORTS: readonly ExportItem[] = [
  { label: 'PNG (2x)', shortcut: '⌘E', run: () => void exportPng(2) },
  { label: 'SVG (vectorial)', shortcut: '⇧⌘E', run: exportSvg },
  { label: 'JSON del diagrama', shortcut: '⌘S', run: exportJson },
]

export function ExportMenu({ items = DRAWN_EXPORTS }: { items?: readonly ExportItem[] }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const anchor = open ? buttonRef.current?.getBoundingClientRect() : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-medium text-ink transition hover:bg-accent-soft"
      >
        <Download size={15} />
        Exportar
        <ChevronDown size={13} className="text-faint" />
      </button>
      {anchor && (
        <MenuShell
          x={anchor.right - EXPORT_MENU_WIDTH_PX}
          y={anchor.bottom + 4}
          width="w-52"
          onClose={() => setOpen(false)}
          anchorRef={buttonRef}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.run()
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-[6px] px-2.5 py-1.5 text-left text-[13px] text-ink transition hover:bg-accent-soft"
            >
              {item.label}
              <kbd className="text-[11px] text-faint">{item.shortcut}</kbd>
            </button>
          ))}
        </MenuShell>
      )}
    </>
  )
}

export default function TopBar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const kind = useDocument((state) => state.kind)
  const title = useDocument((state) => state.meta.title)
  const setMeta = useDocument((state) => state.setMeta)
  const undo = useDocument((state) => state.undo)
  const redo = useDocument((state) => state.redo)
  const canUndo = useDocument((state) => state.past.length > 0)
  const canRedo = useDocument((state) => state.future.length > 0)
  const snapToGrid = useDocument((state) => state.ui.snapToGrid)
  const setUi = useDocument((state) => state.setUi)
  const align = useDocument((state) => state.align)
  const distribute = useDocument((state) => state.distribute)
  const selectedCount = useDocument(
    (state) => state.nodes.filter((node) => node.selected).length,
  )
  const closeDiagram = useLibrary((state) => state.closeDiagram)
  const createDiagram = useLibrary((state) => state.createDiagram)
  const toggleZen = useView((state) => state.toggleZen)
  const type = diagramType(kind)

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
        label={`Nuevo diagrama de ${type.title.toLowerCase()}`}
        onClick={() => createDiagram(kind)}
      />
      <ToolButton icon={<FolderOpen size={16} />} label="Abrir JSON (⌘O)" onClick={() => void importJson()} />
      <ToolButton icon={<Save size={16} />} label="Guardar JSON (⌘S)" onClick={exportJson} />

      <Divider />

      <ToolButton icon={<Undo2 size={16} />} label="Deshacer (⌘Z)" onClick={undo} disabled={!canUndo} />
      <ToolButton icon={<Redo2 size={16} />} label="Rehacer (⇧⌘Z)" onClick={redo} disabled={!canRedo} />

      <Divider />

      {ALIGN_BUTTONS.map((button) => (
        <ToolButton
          key={button.axis}
          icon={button.icon}
          label={button.label}
          onClick={() => align(button.axis)}
          disabled={selectedCount < 2}
        />
      ))}
      <ToolButton
        icon={<AlignHorizontalSpaceAround size={16} />}
        label="Distribuir horizontalmente"
        onClick={() => distribute('horizontal')}
        disabled={selectedCount < 3}
      />
      <ToolButton
        icon={<AlignVerticalSpaceAround size={16} />}
        label="Distribuir verticalmente"
        onClick={() => distribute('vertical')}
        disabled={selectedCount < 3}
      />

      <Divider />

      <ToolButton
        icon={<Grid3x3 size={16} />}
        label="Ajustar a la grilla (G)"
        active={snapToGrid}
        onClick={() => setUi({ snapToGrid: !snapToGrid })}
      />
      <ToolButton icon={<ZoomOut size={16} />} label="Alejar" onClick={() => zoomOut()} />
      <ToolButton icon={<ZoomIn size={16} />} label="Acercar" onClick={() => zoomIn()} />
      <ToolButton
        icon={<Maximize size={16} />}
        label="Ajustar a la vista (F)"
        onClick={() => fitView({ padding: 0.25, duration: 200 })}
      />

      <Divider />

      <ToolButton
        icon={<Maximize2 size={16} />}
        label="Modo zen (Z)"
        onClick={toggleZen}
      />
      <ThemeButton />
      <ConnectionsMenu />
      <ExportMenu />
    </header>
  )
}
