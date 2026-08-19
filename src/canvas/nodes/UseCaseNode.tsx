import type { NodeProps } from '@xyflow/react'
import type { UmlNode } from '../../types/uml'
import ConnectHandles from '../ConnectHandles'
import EditableLabel from '../EditableLabel'
import ResizeFrame from './ResizeFrame'
import { useFlagged, useNodeEditing } from './useNodeState'

/** UML 2.5 use case: an ellipse holding a "verb + object" name. */
export default function UseCaseNode({ id, data, selected }: NodeProps<UmlNode>) {
  const { editing, setEditing, commitLabel } = useNodeEditing(id)
  const flagged = useFlagged(id)

  return (
    <div
      className={`uml-selectable uml-glass flex h-full w-full items-center justify-center rounded-[50%] px-5 text-center leading-tight ${
        flagged ? 'uml-flagged' : ''
      }`}
      style={{
        background: data.fill ?? 'var(--uml-usecase-fill)',
        border: `1.6px ${data.lineStyle} ${data.stroke ?? 'var(--uml-ink)'}`,
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <ResizeFrame kind="useCase" selected={selected ?? false} />
      <EditableLabel
        value={data.label}
        onCommit={commitLabel}
        editing={editing}
        onEditingChange={setEditing}
        fontSize={data.fontSize}
        placeholder="Registrar venta"
      />
      <ConnectHandles nodeId={id} />
    </div>
  )
}
