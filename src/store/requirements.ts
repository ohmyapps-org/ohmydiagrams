import { create } from 'zustand'
import { pickFile } from '../export/download'
import { heuristicExtractor } from '../requirements/heuristic'
import { createLlmExtractor } from '../requirements/llm'
import { REQUIREMENTS_ACCEPT, readRequirementsFile } from '../requirements/read'
import type { RequirementCandidate, RequirementExtractor } from '../requirements/types'
import { useLlm } from './llm'
import { toast } from './toasts'

/** Escape hatch for a reader that is neither the local one nor a chat model. */
let override: RequirementExtractor | null = null

export function setRequirementExtractor(next: RequirementExtractor): void {
  override = next
}

/**
 * Resolved per import, not once at startup: the connection can be edited in
 * the settings dialog between one file and the next.
 */
function activeExtractor(): RequirementExtractor {
  if (override) return override
  const { config, configured } = useLlm.getState()
  return configured ? createLlmExtractor(config) : heuristicExtractor
}

export type RequirementsStatus = 'idle' | 'reading' | 'ready'

interface RequirementsState {
  status: RequirementsStatus
  /** Name of the imported file, shown as the source of the list. */
  sourceName: string | null
  /** Which reader produced the current list, since the two can disagree. */
  extractorLabel: string | null
  candidates: RequirementCandidate[]
  importFile: (file: File) => Promise<void>
  importFromPicker: () => Promise<void>
  dismiss: (id: string) => void
  clear: () => void
}

type IdleState = Pick<
  RequirementsState,
  'status' | 'sourceName' | 'extractorLabel' | 'candidates'
>

const idle = (): IdleState => ({
  status: 'idle',
  sourceName: null,
  extractorLabel: null,
  candidates: [],
})

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export const useRequirements = create<RequirementsState>((set) => ({
  ...idle(),

  importFile: async (file) => {
    set({ status: 'reading', sourceName: file.name })

    let text: string
    try {
      text = await readRequirementsFile(file)
    } catch (error) {
      set(idle())
      toast.error(messageOf(error, 'No se pudo leer el archivo.'))
      return
    }

    const extractor = activeExtractor()
    let label = extractor.label
    let candidates: RequirementCandidate[]
    try {
      candidates = await extractor.extract(text)
    } catch (error) {
      if (extractor === heuristicExtractor) {
        set(idle())
        toast.error(messageOf(error, 'No se pudo leer el archivo.'))
        return
      }
      // The model failed, but the document is already parsed: say why and fall
      // back to the local reader rather than throwing the import away.
      toast.error(`${messageOf(error, 'Falló el modelo.')} Se leyó localmente.`)
      candidates = await heuristicExtractor.extract(text)
      label = heuristicExtractor.label
    }

    set({ status: 'ready', extractorLabel: label, candidates })
    if (candidates.length === 0) {
      toast.info('No se encontró ningún requisito con forma de caso de uso.')
    } else {
      toast.success(`${candidates.length} casos de uso propuestos.`)
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

  clear: () => set(idle()),
}))
