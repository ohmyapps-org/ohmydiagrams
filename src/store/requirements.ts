import { create } from 'zustand'
import { pickFile } from '../export/download'
import { heuristicExtractor } from '../requirements/heuristic'
import { REQUIREMENTS_ACCEPT, readRequirementsFile } from '../requirements/read'
import type { RequirementCandidate, RequirementExtractor } from '../requirements/types'
import { toast } from './toasts'

/** Swap point for an LLM-backed reader; the UI never learns which one runs. */
let extractor: RequirementExtractor = heuristicExtractor

export function setRequirementExtractor(next: RequirementExtractor): void {
  extractor = next
}

export type RequirementsStatus = 'idle' | 'reading' | 'ready'

interface RequirementsState {
  status: RequirementsStatus
  /** Name of the imported file, shown as the source of the list. */
  sourceName: string | null
  candidates: RequirementCandidate[]
  importFile: (file: File) => Promise<void>
  importFromPicker: () => Promise<void>
  dismiss: (id: string) => void
  clear: () => void
}

export const useRequirements = create<RequirementsState>((set) => ({
  status: 'idle',
  sourceName: null,
  candidates: [],

  importFile: async (file) => {
    set({ status: 'reading', sourceName: file.name })
    try {
      const candidates = await extractor.extract(await readRequirementsFile(file))
      set({ status: 'ready', candidates })
      if (candidates.length === 0) {
        toast.info('No se encontró ningún requisito con forma de caso de uso.')
      } else {
        toast.success(`${candidates.length} casos de uso propuestos.`)
      }
    } catch (error) {
      set({ status: 'idle', sourceName: null, candidates: [] })
      toast.error(
        error instanceof Error ? error.message : 'No se pudo leer el archivo.',
      )
    }
  },

  importFromPicker: async () => {
    const file = await pickFile(REQUIREMENTS_ACCEPT)
    if (file) await useRequirements.getState().importFile(file)
  },

  dismiss: (id) =>
    set((state) => ({
      candidates: state.candidates.filter((item) => item.id !== id),
    })),

  clear: () => set({ status: 'idle', sourceName: null, candidates: [] }),
}))
