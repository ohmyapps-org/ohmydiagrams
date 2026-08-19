import {
  Circle,
  ClipboardPaste,
  Frame,
  LayoutTemplate,
  StickyNote,
  Type,
  User,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NODE_SPECS, type UmlNodeKind } from '../types/uml'
import MenuShell, { MenuItem, MenuSeparator } from './MenuShell'

export interface QuickMenuTarget {
  /** Screen coordinates, for placing the menu. */
  x: number
  y: number
}

const SHORTCUTS: readonly { kind: UmlNodeKind; icon: ReactNode }[] = [
  { kind: 'actor', icon: <User size={14} /> },
  { kind: 'useCase', icon: <Circle size={14} /> },
  { kind: 'boundary', icon: <Frame size={14} /> },
  { kind: 'note', icon: <StickyNote size={14} /> },
  { kind: 'text', icon: <Type size={14} /> },
]

interface Props {
  target: QuickMenuTarget
  canPaste: boolean
  onClose: () => void
  onSkeleton: () => void
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
  onClose,
  onSkeleton,
  onCreate,
  onPaste,
}: Props) {
  return (
    <MenuShell x={target.x} y={target.y} width="w-56" onClose={onClose}>
      <MenuItem
        icon={<LayoutTemplate size={14} />}
        label="Diagrama de ejemplo"
        onClick={onSkeleton}
      />
      <MenuSeparator />
      {SHORTCUTS.map((entry) => (
        <MenuItem
          key={entry.kind}
          icon={entry.icon}
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
