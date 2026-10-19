import type { NodeProps } from '@xyflow/react'
import { useCallback } from 'react'
import { useDocument } from '../../store/document'
import {
  NODE_SPECS,
  classifierStereotype,
  memberLines,
  type UmlNode,
  type UmlNodeKind,
} from '../../types/uml'
import ConnectHandles from '../ConnectHandles'
import EditableLabel from '../EditableLabel'
import ResizeFrame from './ResizeFrame'
import { useFlagged, useNodeEditing } from './useNodeState'

function compactMembers(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
}

function useFieldEditing(id: string, field: string) {
  const editing = useDocument((state) => state.ui.editingId === `${id}::${field}`)
  const setUi = useDocument((state) => state.setUi)
  const setEditing = useCallback(
    (next: boolean) => setUi({ editingId: next ? `${id}::${field}` : null }),
    [id, field, setUi],
  )
  return { editing, setEditing }
}

function Compartment({
  nodeId,
  field,
  lines,
  fontSize,
}: {
  nodeId: string
  field: 'attributes' | 'operations'
  lines: readonly string[]
  fontSize: number
}) {
  const { editing, setEditing } = useFieldEditing(nodeId, field)
  const updateNodeData = useDocument((state) => state.updateNodeData)
  const visible = memberLines(lines)

  return (
    <div
      className="min-h-[28px] flex-1 overflow-hidden px-2 py-1 text-left leading-snug"
      onDoubleClick={(event) => {
        event.stopPropagation()
        setEditing(true)
      }}
    >
      {editing ? (
        <EditableLabel
          value={visible.join('\n')}
          onCommit={(value) => updateNodeData(nodeId, { [field]: compactMembers(value) })}
          editing
          onEditingChange={setEditing}
          fontSize={fontSize}
          className="!text-left"
          placeholder=""
          multiline
        />
      ) : (
        <ul className="whitespace-pre-wrap break-words" style={{ fontSize }}>
          {visible.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** UML 2.5 classifier: name band, attributes, operations. */
export default function ClassNode({ id, data, selected, type }: NodeProps<UmlNode>) {
  const kind = (type ?? 'class') as UmlNodeKind
  const { editing, setEditing, commitLabel } = useNodeEditing(id)
  const flagged = useFlagged(id)
  const stroke = data.stroke ?? 'var(--uml-ink)'
  const stereotype = classifierStereotype(kind)
  const memberSize = Math.max(10, data.fontSize - 2)

  return (
    <div
      className={`uml-selectable uml-glass flex h-full w-full flex-col overflow-hidden ${
        flagged ? 'uml-flagged' : ''
      }`}
      style={{
        background: data.fill ?? 'var(--uml-class-fill)',
        border: `1.6px ${data.lineStyle} ${stroke}`,
        color: stroke,
      }}
    >
      <ResizeFrame kind={kind} selected={selected ?? false} />
      <div
        className="flex shrink-0 flex-col items-center justify-center px-2 py-1.5 text-center"
        onDoubleClick={() => setEditing(true)}
      >
        {stereotype && (
          <span className="text-[10px] leading-tight text-muted">«{stereotype}»</span>
        )}
        <EditableLabel
          value={data.label}
          onCommit={commitLabel}
          editing={editing}
          onEditingChange={setEditing}
          fontSize={data.fontSize}
          className={`font-semibold ${kind === 'interface' ? 'italic' : ''}`}
          placeholder={NODE_SPECS[kind].defaultLabel}
        />
      </div>
      <div
        className="h-px w-full shrink-0"
        style={{ background: stroke, opacity: 0.7 }}
      />
      <Compartment
        nodeId={id}
        field="attributes"
        lines={data.attributes}
        fontSize={memberSize}
      />
      <div
        className="h-px w-full shrink-0"
        style={{ background: stroke, opacity: 0.7 }}
      />
      <Compartment
        nodeId={id}
        field="operations"
        lines={data.operations}
        fontSize={memberSize}
      />
      <ConnectHandles nodeId={id} />
    </div>
  )
}
