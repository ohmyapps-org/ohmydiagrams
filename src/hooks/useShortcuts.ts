import { useReactFlow } from '@xyflow/react'
import { useEffect } from 'react'
import { exportJson, exportPng, exportSvg, importJson } from '../export'
import { useDocument } from '../store/document'
import { useView } from '../store/view'

/** True when the user is typing, so shortcuts must stay out of the way. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function useShortcuts(): void {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const store = useDocument.getState()
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      // Escape always applies: it closes the inline editor and drops selection.
      if (key === 'escape') {
        if (store.ui.editingId) store.setUi({ editingId: null })
        else {
          store.clearSelection()
          store.setFlagged([])
        }
        return
      }

      if (isTyping(event.target)) return

      if (mod) {
        switch (key) {
          case 'z':
            event.preventDefault()
            if (event.shiftKey) store.redo()
            else store.undo()
            return
          case 'y':
            event.preventDefault()
            store.redo()
            return
          case 'a':
            event.preventDefault()
            store.selectAll()
            return
          case 'c':
            event.preventDefault()
            store.copySelection()
            return
          case 'v':
            event.preventDefault()
            store.paste()
            return
          case 'd':
            event.preventDefault()
            store.duplicateSelection()
            return
          case 's':
            event.preventDefault()
            exportJson()
            return
          case 'o':
            event.preventDefault()
            void importJson()
            return
          case 'e':
            event.preventDefault()
            if (event.shiftKey) exportSvg()
            else void exportPng(2)
            return
          case '=':
          case '+':
            event.preventDefault()
            zoomIn()
            return
          case '-':
            event.preventDefault()
            zoomOut()
            return
          default:
            return
        }
      }

      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          event.preventDefault()
          store.deleteSelection()
          return
        case 'F2': {
          event.preventDefault()
          const selected =
            store.nodes.find((node) => node.selected) ??
            store.edges.find((edge) => edge.selected)
          if (selected) store.setUi({ editingId: selected.id })
          return
        }
        default:
          break
      }

      switch (key) {
        case 'f':
          event.preventDefault()
          fitView({ padding: 0.25, duration: 200 })
          return
        case 'g':
          event.preventDefault()
          store.setUi({ snapToGrid: !store.ui.snapToGrid })
          return
        case 'z':
          event.preventDefault()
          useView.getState().toggleZen()
          return
        default:
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zoomIn, zoomOut, fitView])
}
