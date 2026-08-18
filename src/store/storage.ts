import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage wrapper that coalesces writes. Dragging a node fires dozens of
 * state updates per second; without this every one of them would serialise the
 * whole document synchronously on the main thread.
 */
export function createDebouncedStorage(delayMs: number): StateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null
  let queuedKey: string | null = null
  let queuedValue: string | null = null

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (queuedKey === null || queuedValue === null) return
    try {
      localStorage.setItem(queuedKey, queuedValue)
    } catch {
      // Quota exceeded or private mode: autosave is a convenience, not a
      // guarantee. Manual JSON export remains available.
    }
    queuedKey = null
    queuedValue = null
  }

  if (typeof window !== 'undefined') {
    // pagehide covers the mobile/bfcache path that beforeunload misses.
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
  }

  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      queuedKey = name
      queuedValue = value
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    removeItem: (name) => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      queuedKey = null
      queuedValue = null
      try {
        localStorage.removeItem(name)
      } catch {
        // ignore
      }
    },
  }
}
