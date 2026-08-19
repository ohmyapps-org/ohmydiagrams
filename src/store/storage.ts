import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage wrapper that coalesces writes. Dragging a node fires dozens of
 * state updates per second; without this every one of them would serialise the
 * whole document synchronously on the main thread.
 */
export function createDebouncedStorage(delayMs: number): StateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null
  // Keyed, because one save touches both the document and the library index.
  const queued = new Map<string, string>()

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    for (const [key, value] of queued) {
      try {
        localStorage.setItem(key, value)
      } catch {
        // Quota exceeded or private mode: autosave is a convenience, not a
        // guarantee. Manual JSON export remains available.
      }
    }
    queued.clear()
  }

  if (typeof window !== 'undefined') {
    // pagehide covers the mobile/bfcache path that beforeunload misses.
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
  }

  return {
    getItem: (name) => {
      try {
        // A queued write is the truth until it lands.
        return queued.get(name) ?? localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      queued.set(name, value)
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
    removeItem: (name) => {
      queued.delete(name)
      try {
        localStorage.removeItem(name)
      } catch {
        // ignore
      }
    },
  }
}
