import { useCallback } from 'react'
import { useDocument } from '../../store/document'

export interface NodeEditing {
  editing: boolean
  setEditing: (editing: boolean) => void
  commitLabel: (label: string) => void
}

/**
 * Inline editing lives in the store rather than in component state so that the
 * context menu, F2 and the checklist's rename fix can all open the same editor,
 * and so only one editor is ever open at a time.
 */
export function useNodeEditing(id: string): NodeEditing {
  const editing = useDocument((state) => state.ui.editingId === id)
  const setUi = useDocument((state) => state.setUi)
  const updateNodeData = useDocument((state) => state.updateNodeData)

  const setEditing = useCallback(
    (next: boolean) => setUi({ editingId: next ? id : null }),
    [id, setUi],
  )

  const commitLabel = useCallback(
    (label: string) => updateNodeData(id, { label }),
    [id, updateNodeData],
  )

  return { editing, setEditing, commitLabel }
}

/** True while the checklist is pointing at this element. */
export function useFlagged(id: string): boolean {
  return useDocument((state) => state.ui.flagged.includes(id))
}
