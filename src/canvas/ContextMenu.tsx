import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Pencil,
  Repeat2,
  Trash2,
} from 'lucide-react'
import MenuShell, { MenuItem, MenuSeparator } from './MenuShell'

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
  const isNode = target.kind === 'node'

  return (
    <MenuShell x={target.x} y={target.y} width="w-52" onClose={onClose}>
      <MenuItem
        icon={<Pencil size={14} />}
        label="Editar texto"
        shortcut="F2"
        onClick={onEditLabel}
      />
      {isNode ? (
        <>
          <MenuItem
            icon={<Copy size={14} />}
            label="Duplicar"
            shortcut="⌘D"
            onClick={onDuplicate}
          />
          <MenuItem
            icon={<ArrowUpToLine size={14} />}
            label="Traer al frente"
            onClick={onBringToFront}
          />
          <MenuItem
            icon={<ArrowDownToLine size={14} />}
            label="Enviar al fondo"
            onClick={onSendToBack}
          />
        </>
      ) : (
        <MenuItem
          icon={<Repeat2 size={14} />}
          label="Invertir dirección"
          onClick={onReverse}
        />
      )}
      <MenuSeparator />
      <MenuItem
        icon={<Trash2 size={14} />}
        label="Eliminar"
        shortcut="Supr"
        danger
        onClick={onDelete}
      />
    </MenuShell>
  )
}
