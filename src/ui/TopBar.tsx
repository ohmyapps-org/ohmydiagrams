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
  Download,
  FilePlus2,
  FolderOpen,
  Grid3x3,
  Maximize,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { exportJson, exportPng, exportSvg, importJson } from '../export'
import { useDocument } from '../store/document'
import type { AlignAxis } from '../uml/geometry'

function ToolButton({
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
      className={`flex h-8 w-8 items-center justify-center rounded-control transition disabled:opacity-30 ${
        active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-accent-soft'
      }`}
    >
      {icon}
    </button>
  )
}

function Divider() {
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

function ExportMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', dismiss)
    return () => window.removeEventListener('mousedown', dismiss)
  }, [open])

  const items: { label: string; shortcut: string; run: () => void }[] = [
    { label: 'PNG (2x)', shortcut: '⌘E', run: () => void exportPng(2) },
    { label: 'SVG (vectorial)', shortcut: '⇧⌘E', run: exportSvg },
    { label: 'JSON del diagrama', shortcut: '⌘S', run: exportJson },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-medium text-ink transition hover:bg-accent-soft"
      >
        <Download size={15} />
        Exportar
        <ChevronDown size={13} className="text-faint" />
      </button>
      {open && (
        <div className="glass absolute right-0 top-9 z-50 w-52 rounded-panel p-1">
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
        </div>
      )}
    </div>
  )
}

export default function TopBar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

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
  const resetDocument = useDocument((state) => state.resetDocument)
  const selectedCount = useDocument(
    (state) => state.nodes.filter((node) => node.selected).length,
  )

  return (
    <header className="glass relative z-30 flex h-14 shrink-0 items-center gap-1 rounded-panel px-3">
      <div className="flex items-center gap-2 pr-1">
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Oh My Diagrams
        </span>
        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          UML 2.5
        </span>
      </div>

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

      <ToolButton icon={<FilePlus2 size={16} />} label="Nuevo diagrama" onClick={resetDocument} />
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

      <ExportMenu />
    </header>
  )
}
