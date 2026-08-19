import { create } from 'zustand'

const STORAGE_KEY = 'ohmydiagrams:zen:v1'

interface ViewState {
  /** Zen mode: canvas only, every panel out of the way. */
  zen: boolean
  toggleZen: () => void
  setZen: (zen: boolean) => void
}

function store(zen: boolean): void {
  if (zen) localStorage.setItem(STORAGE_KEY, 'on')
  else localStorage.removeItem(STORAGE_KEY)
}

export const useView = create<ViewState>((set, get) => ({
  zen: localStorage.getItem(STORAGE_KEY) === 'on',

  toggleZen: () => get().setZen(!get().zen),

  setZen: (zen) => {
    store(zen)
    set({ zen })
  },
}))
