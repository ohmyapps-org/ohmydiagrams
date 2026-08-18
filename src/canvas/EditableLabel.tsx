import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onCommit: (value: string) => void
  editing: boolean
  onEditingChange: (editing: boolean) => void
  fontSize: number
  className?: string
  placeholder?: string
  /** Enter inserts a newline instead of committing; commit with Escape/blur. */
  multiline?: boolean
}

/**
 * Inline label editing shared by every node and by edge labels.
 * Enter commits, Escape cancels, blur commits.
 */
export default function EditableLabel({
  value,
  onCommit,
  editing,
  onEditingChange,
  fontSize,
  className = '',
  placeholder = 'Sin nombre',
  multiline = false,
}: Props) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) setDraft(value)
  }, [editing, value])

  useEffect(() => {
    if (!editing) return
    const element = ref.current
    if (!element) return
    element.focus()
    element.select()
  }, [editing])

  if (!editing) {
    return (
      <span
        className={`whitespace-pre-wrap break-words ${className} ${
          value.trim() ? '' : 'text-faint italic'
        }`}
        style={{ fontSize }}
      >
        {value.trim() || placeholder}
      </span>
    )
  }

  const commit = (): void => {
    onCommit(draft.trim())
    onEditingChange(false)
  }

  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      spellCheck={false}
      // Keep React Flow from treating typing as canvas shortcuts or a drag.
      className={`nodrag nopan w-full resize-none overflow-hidden rounded-[4px] border border-accent bg-surface px-1 text-center outline-none ${className}`}
      style={{ fontSize }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          commit()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          onEditingChange(false)
        }
      }}
    />
  )
}
