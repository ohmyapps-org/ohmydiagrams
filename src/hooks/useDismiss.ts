import { useEffect, type RefObject } from 'react'

/**
 * Closes an anchored menu on a click outside of it or on Escape.
 *
 * Only subscribes while the menu is open, so a closed menu costs nothing.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return
    const outside = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onDismiss()
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('mousedown', outside)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('mousedown', outside)
      window.removeEventListener('keydown', escape)
    }
  }, [ref, onDismiss, active])
}
