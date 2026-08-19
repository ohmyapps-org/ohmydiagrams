import type { NodeProps } from '@xyflow/react'
import type { UmlNode, UmlNodeKind } from '../../types/uml'
import ConnectHandles from '../ConnectHandles'
import EditableLabel from '../EditableLabel'
import ResizeFrame from './ResizeFrame'
import { useFlagged, useNodeEditing } from './useNodeState'

/** Generic drawing shapes for ad-hoc conceptual flows: rectangle, ellipse, diamond. */
export default function ShapeNode({ id, type, data, selected }: NodeProps<UmlNode>) {
  const kind = (type ?? 'rectangle') as UmlNodeKind
  const { editing, setEditing, commitLabel } = useNodeEditing(id)
  const flagged = useFlagged(id)

  const fill = data.fill ?? 'var(--uml-shape-fill)'
  const stroke = data.stroke ?? 'var(--uml-ink)'
  const dash = data.lineStyle === 'dashed' ? '6 4' : undefined

  return (
    <div
      className={`uml-selectable relative h-full w-full ${flagged ? 'uml-flagged' : ''}`}
      onDoubleClick={() => setEditing(true)}
    >
      <ResizeFrame kind={kind} selected={selected ?? false} />
      {/* Frosted layer clipped to the silhouette, behind the drawn shape. */}
      <div className={`uml-glass-layer uml-glass-layer--${kind}`} aria-hidden />
      <svg
        className="uml-ink-shadow absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {kind === 'ellipse' && (
          <ellipse
            cx="50"
            cy="50"
            rx="49"
            ry="49"
            fill={fill}
            stroke={stroke}
            strokeDasharray={dash}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1.6}
          />
        )}
        {kind === 'diamond' && (
          <polygon
            points="50,1 99,50 50,99 1,50"
            fill={fill}
            stroke={stroke}
            strokeDasharray={dash}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1.6}
          />
        )}
        {kind === 'rectangle' && (
          <rect
            x="1"
            y="1"
            width="98"
            height="98"
            rx="2"
            fill={fill}
            stroke={stroke}
            strokeDasharray={dash}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1.6}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center px-3 text-center leading-tight">
        <EditableLabel
          value={data.label}
          onCommit={commitLabel}
          editing={editing}
          onEditingChange={setEditing}
          fontSize={data.fontSize}
          placeholder=""
        />
      </div>
      <ConnectHandles nodeId={id} />
    </div>
  )
}
