import { create } from 'zustand'

const STORAGE_KEY = 'ohmydiagrams:theme:v1'

export type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
}

const systemQuery = window.matchMedia('(prefers-color-scheme: dark)')

function stored(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'dark' || value === 'light' ? value : null
}

/** The palettes live in `index.css` under `[data-theme]`; this is the switch. */
function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

const initial: Theme = stored() ?? (systemQuery.matches ? 'dark' : 'light')
apply(initial)

export const useTheme = create<ThemeState>((set, get) => {
  // Until the user picks a side, follow the operating system.
  systemQuery.addEventListener('change', (event) => {
    if (stored()) return
    const next: Theme = event.matches ? 'dark' : 'light'
    apply(next)
    set({ theme: next })
  })

  return {
    theme: initial,
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, next)
      apply(next)
      set({ theme: next })
    },
  }
})
