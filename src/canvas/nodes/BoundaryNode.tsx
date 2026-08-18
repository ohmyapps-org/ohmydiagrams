import type { NodeProps } from '@xyflow/react'
import type { UmlNode } from '../../types/uml'
import EditableLabel from '../EditableLabel'
import ResizeFrame from './ResizeFrame'
import { useFlagged, useNodeEditing } from './useNodeState'

export const BOUNDARY_HEADER_HEIGHT = 38

/**
 * System boundary: everything the system does lives inside this rectangle,
 * every actor stays outside. It carries no connection handles because the
 * boundary does not participate in relationships — it contains them.
 */
export default function BoundaryNode({ id, data, selected }: NodeProps<UmlNode>) {
  const { editing, setEditing, commitLabel } = useNodeEditing(id)
  const flagged = useFlagged(id)

  return (
    <div
      className={`uml-selectable flex h-full w-full flex-col rounded-[10px] ${
        flagged ? 'uml-flagged' : ''
      }`}
      style={{
        background: data.fill ?? 'var(--uml-boundary-fill)',
        border: `1.6px ${data.lineStyle} ${
          data.stroke ?? 'var(--uml-boundary-stroke)'
        }`,
      }}
    >
      <ResizeFrame kind="boundary" selected={selected ?? false} />
      <div
        className="flex items-center justify-center border-b px-4 font-semibold"
        style={{
          height: BOUNDARY_HEADER_HEIGHT,
          borderColor: data.stroke ?? 'var(--uml-boundary-stroke)',
        }}
        onDoubleClick={() => setEditing(true)}
      >
        <EditableLabel
          value={data.label}
          onCommit={commitLabel}
          editing={editing}
          onEditingChange={setEditing}
          fontSize={data.fontSize}
          placeholder="Sistema"
        />
      </div>
      {/* Transparent body: use cases dropped here stay clickable. */}
      <div className="pointer-events-none flex-1" />
    </div>
  )
}
