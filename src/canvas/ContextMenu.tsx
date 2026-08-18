import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Pencil,
  Trash2,
  Repeat2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuTarget {
  x: number
  y: number
  kind: 'node' | 'edge'
  id: string
}

interface Props {
  target: ContextMenuTarget
  onClose: () => void
  onEditLabel: () => void
  onDuplicate: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onReverse: () => void
  onDelete: () => void
}

function Item({
  icon,
  label,
  shortcut,
  danger,
  onClick,
}: {
  icon: ReactNode
  label: string
  shortcut?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition hover:bg-accent-soft ${
        danger ? 'text-danger' : 'text-ink'
      }`}
    >
      <span className="text-faint">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <kbd className="text-[11px] text-faint">{shortcut}</kbd>}
    </button>
  )
}

export default function ContextMenu({
  target,
  onClose,
  onEditLabel,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onReverse,
  onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dismiss = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('mousedown', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [onClose])

  const isNode = target.kind === 'node'

  // Portalled to <body>: the canvas panel uses backdrop-filter, which makes it
  // the containing block for fixed children and clips them to its bounds.
  return createPortal(
    <div
      ref={ref}
      className="glass fixed z-50 w-52 rounded-panel p-1"
      style={{ left: target.x, top: target.y }}
    >
      <Item
        icon={<Pencil size={14} />}
        label="Editar texto"
        shortcut="F2"
        onClick={onEditLabel}
      />
      {isNode ? (
        <>
          <Item
            icon={<Copy size={14} />}
            label="Duplicar"
            shortcut="⌘D"
            onClick={onDuplicate}
          />
          <Item
            icon={<ArrowUpToLine size={14} />}
            label="Traer al frente"
            onClick={onBringToFront}
          />
          <Item
            icon={<ArrowDownToLine size={14} />}
            label="Enviar al fondo"
            onClick={onSendToBack}
          />
        </>
      ) : (
        <Item
          icon={<Repeat2 size={14} />}
          label="Invertir dirección"
          onClick={onReverse}
        />
      )}
      <div className="my-1 h-px bg-line" />
      <Item
        icon={<Trash2 size={14} />}
        label="Eliminar"
        shortcut="Supr"
        danger
        onClick={onDelete}
      />
    </div>,
    document.body,
  )
}
