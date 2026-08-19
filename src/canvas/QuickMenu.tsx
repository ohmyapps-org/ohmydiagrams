import { ClipboardPaste, LayoutTemplate } from 'lucide-react'
import type { PaletteShape } from '../diagrams/types'
import { NODE_SPECS, type UmlNodeKind } from '../types/uml'
import MenuShell, { MenuItem, MenuSeparator } from './MenuShell'

export interface QuickMenuTarget {
  /** Screen coordinates, for placing the menu. */
  x: number
  y: number
}

interface Props {
  target: QuickMenuTarget
  canPaste: boolean
  /** Shapes of the open diagram's kind, in palette order. */
  shapes: readonly PaletteShape[]
  onClose: () => void
  /** Absent for kinds that have no ready-made example to drop. */
  onSkeleton?: () => void
  onCreate: (kind: UmlNodeKind) => void
  onPaste: () => void
}

/**
 * Opens on a plain left click over empty canvas: the fastest path from "blank
 * page" to a diagram, without a trip to the palette.
 */
export default function QuickMenu({
  target,
  canPaste,
  shapes,
  onClose,
  onSkeleton,
  onCreate,
  onPaste,
}: Props) {
  return (
    <MenuShell x={target.x} y={target.y} width="w-56" onClose={onClose}>
      {onSkeleton && (
        <>
          <MenuItem
            icon={<LayoutTemplate size={14} />}
            label="Diagrama de ejemplo"
            onClick={onSkeleton}
          />
          <MenuSeparator />
        </>
      )}
      {shapes.map((entry) => (
        <MenuItem
          key={entry.kind}
          icon={<entry.icon size={14} />}
          label={NODE_SPECS[entry.kind].title}
          onClick={() => onCreate(entry.kind)}
        />
      ))}
      {canPaste && (
        <>
          <MenuSeparator />
          <MenuItem
            icon={<ClipboardPaste size={14} />}
            label="Pegar acá"
            shortcut="⌘V"
            onClick={onPaste}
          />
        </>
      )}
    </MenuShell>
  )
}
