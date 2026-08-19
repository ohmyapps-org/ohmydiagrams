import type { ReactNode, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_MARGIN = 8

interface Props {
  x: number
  y: number
  width: string
  onClose: () => void
  children: ReactNode
  /**
   * A toggle button that opens this menu, if any. Clicks on it are not
   * treated as "outside": otherwise the button's own click handler would
   * reopen the menu right after this dismiss logic closes it.
   */
  anchorRef?: RefObject<HTMLElement | null>
}

/**
 * Floating menu surface shared by the context menu and the quick menu.
 *
 * Portalled to `<body>`: the canvas panel uses `backdrop-filter`, which makes
 * it the containing block for fixed children and clips them to its bounds.
 */
export default function MenuShell({ x, y, width, onClose, children, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // Measure after paint so a menu opened near an edge folds back into view.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const box = element.getBoundingClientRect()
    setPosition({
      left: Math.max(
        VIEWPORT_MARGIN,
        Math.min(x, window.innerWidth - box.width - VIEWPORT_MARGIN),
      ),
      top: Math.max(
        VIEWPORT_MARGIN,
        Math.min(y, window.innerHeight - box.height - VIEWPORT_MARGIN),
      ),
    })
  }, [x, y])

  useEffect(() => {
    const dismiss = (event: MouseEvent): void => {
      const target = event.target as Node
      if (ref.current?.contains(target)) return
      if (anchorRef?.current?.contains(target)) return
      onClose()
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('mousedown', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [onClose, anchorRef])

  return createPortal(
    <div
      ref={ref}
      className={`glass fixed z-50 rounded-panel p-1 ${width}`}
      style={{ left: position.left, top: position.top }}
    >
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({
  icon,
  label,
  shortcut,
  danger,
  onClick,
}: {
  icon: ReactNode
  label: string
  shortcut?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition hover:bg-accent-soft ${
        danger ? 'text-danger' : 'text-ink'
      }`}
    >
      <span className="text-faint">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <kbd className="text-[11px] text-faint">{shortcut}</kbd>}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />
}
