import type { NodeProps } from '@xyflow/react'
import type { UmlNode } from '../../types/uml'
import ConnectHandles from '../ConnectHandles'
import EditableLabel from '../EditableLabel'
import ResizeFrame from './ResizeFrame'
import { useFlagged, useNodeEditing } from './useNodeState'

export const NOTE_FOLD = 16

/** Free-text annotation, drawn with the classic folded corner. */
export default function NoteNode({ id, data, selected }: NodeProps<UmlNode>) {
  const { editing, setEditing, commitLabel } = useNodeEditing(id)
  const flagged = useFlagged(id)
  const stroke = data.stroke ?? 'var(--uml-note-stroke)'
  const fill = data.fill ?? 'var(--uml-note-fill)'

  return (
    <div
      className={`uml-selectable relative h-full w-full ${flagged ? 'uml-flagged' : ''}`}
      onDoubleClick={() => setEditing(true)}
    >
      <ResizeFrame kind="note" selected={selected ?? false} />
      {/* The fold is a CSS corner cut plus a triangle overlay, which survives
          arbitrary resizing better than a fixed viewBox path. */}
      <div
        className="uml-glass h-full w-full"
        style={{
          background: fill,
          border: `1.4px ${data.lineStyle} ${stroke}`,
          clipPath: `polygon(0 0, calc(100% - ${NOTE_FOLD}px) 0, 100% ${NOTE_FOLD}px, 100% 100%, 0 100%)`,
        }}
      />
      <div
        className="absolute right-0 top-0"
        style={{
          width: NOTE_FOLD,
          height: NOTE_FOLD,
          background: stroke,
          clipPath: 'polygon(0 0, 100% 100%, 0 100%)',
          opacity: 0.35,
        }}
      />
      <div className="absolute inset-0 flex items-start justify-start p-2 text-left leading-snug">
        <EditableLabel
          value={data.label}
          onCommit={commitLabel}
          editing={editing}
          onEditingChange={setEditing}
          fontSize={data.fontSize}
          className="!text-left"
          placeholder="Nota"
          multiline
        />
      </div>
      <ConnectHandles nodeId={id} />
    </div>
  )
}
