import type { NodeProps } from '@xyflow/react'
import type { UmlNode } from '../../types/uml'
import ConnectHandles from '../ConnectHandles'
import EditableLabel from '../EditableLabel'
import ResizeFrame from './ResizeFrame'
import { useFlagged, useNodeEditing } from './useNodeState'

/** Bare text label: no frame, no fill. */
export default function TextNode({ id, data, selected }: NodeProps<UmlNode>) {
  const { editing, setEditing, commitLabel } = useNodeEditing(id)
  const flagged = useFlagged(id)

  return (
    <div
      className={`uml-selectable flex h-full w-full items-center justify-center leading-tight ${
        flagged ? 'uml-flagged' : ''
      }`}
      style={{ color: data.stroke ?? 'var(--uml-ink)' }}
      onDoubleClick={() => setEditing(true)}
    >
      <ResizeFrame kind="text" selected={selected ?? false} />
      <EditableLabel
        value={data.label}
        onCommit={commitLabel}
        editing={editing}
        onEditingChange={setEditing}
        fontSize={data.fontSize}
        placeholder="Texto"
      />
      <ConnectHandles nodeId={id} />
    </div>
  )
}
