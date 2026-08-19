import type { NodeProps } from '@xyflow/react'
import type { UmlNode } from '../../types/uml'
import ConnectHandles from '../ConnectHandles'
import EditableLabel from '../EditableLabel'
import ResizeFrame from './ResizeFrame'
import { useFlagged, useNodeEditing } from './useNodeState'

const LABEL_STRIP = 22

/**
 * UML 2.5 actor: stick figure with the name underneath. The silhouette is drawn
 * in a fixed viewBox and scaled, so resizing keeps its proportions.
 */
export default function ActorNode({ id, data, selected }: NodeProps<UmlNode>) {
  const { editing, setEditing, commitLabel } = useNodeEditing(id)
  const flagged = useFlagged(id)
  const stroke = data.stroke ?? 'var(--uml-ink)'

  return (
    <div
      className={`uml-selectable flex h-full w-full flex-col items-center ${
        flagged ? 'uml-flagged' : ''
      }`}
      onDoubleClick={() => setEditing(true)}
    >
      <ResizeFrame kind="actor" selected={selected ?? false} />
      <svg
        viewBox="0 0 60 84"
        preserveAspectRatio="xMidYMid meet"
        className="uml-ink-shadow w-full flex-1"
        style={{ minHeight: 0 }}
        aria-hidden
      >
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="30" cy="13" r="11" />
          <path d="M30 24 L30 52" />
          <path d="M9 34 L51 34" />
          <path d="M30 52 L13 80" />
          <path d="M30 52 L47 80" />
        </g>
      </svg>
      <div
        className="flex w-full items-start justify-center text-center leading-tight"
        style={{ minHeight: LABEL_STRIP }}
      >
        <EditableLabel
          value={data.label}
          onCommit={commitLabel}
          editing={editing}
          onEditingChange={setEditing}
          fontSize={data.fontSize}
          placeholder="Actor"
        />
      </div>
      <ConnectHandles nodeId={id} />
    </div>
  )
}
