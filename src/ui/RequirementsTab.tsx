import { AlertTriangle, Check, CircleDashed, FileUp, Plus, X } from 'lucide-react'
import { useMemo } from 'react'
import { useDocument } from '../store/document'
import { useLlm } from '../store/llm'
import { useRequirements } from '../store/requirements'
import type { RequirementCandidate } from '../requirements/types'
import { nodeKindOf } from '../types/uml'
import { nextUseCaseSlot } from '../uml/placement'
import { normalizeName } from '../uml/verbs'
import ProgressBar from './ProgressBar'

function EmptyState() {
  const status = useRequirements((state) => state.status)
  const importFromPicker = useRequirements((state) => state.importFromPicker)
  const configured = useLlm((state) => state.configured)
  const model = useLlm((state) => state.config.model)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[12.5px] leading-snug text-muted">
        Importá la especificación de requisitos y te propongo los casos de uso
        que deberían estar en el diagrama.
      </p>
      <button
        type="button"
        onClick={() => void importFromPicker()}
        disabled={status === 'reading'}
        className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2.5 py-1.5 text-[12px] font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-40"
      >
        <FileUp size={13} />
        {status === 'reading' ? 'Leyendo…' : 'Importar PDF, Markdown o TXT'}
      </button>
      <p className="text-[11px] leading-snug text-faint">
        {configured
          ? `Lee ${model} en la URL configurada: el texto del archivo se le envía.`
          : 'La lectura es local: el archivo no sale del navegador.'}
      </p>
    </div>
  )
}

function CandidateRow({
  candidate,
  present,
}: {
  candidate: RequirementCandidate
  present: boolean
}) {
  const addNode = useDocument((state) => state.addNode)
  const selectOnly = useDocument((state) => state.selectOnly)
  const dismiss = useRequirements((state) => state.dismiss)

  const add = (): void => {
    const node = addNode(
      'useCase',
      nextUseCaseSlot(useDocument.getState().nodes),
      candidate.name,
    )
    selectOnly([node.id])
  }

  return (
    <li className="flex gap-2.5 rounded-control px-2.5 py-2">
      <span className="mt-0.5 shrink-0">
        {present ? (
          <Check size={15} className="text-ok" />
        ) : (
          <CircleDashed size={15} className="text-faint" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[12.5px] leading-snug ${
            present ? 'text-muted' : 'font-medium text-ink'
          }`}
        >
          {candidate.name}
        </p>
        {candidate.actor && (
          <p className="mt-0.5 text-[11px] leading-snug text-faint">
            Actor: {candidate.actor}
          </p>
        )}
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-faint">
          {candidate.source}
        </p>
        {!candidate.compliant && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] leading-snug text-warn">
            <AlertTriangle size={11} className="shrink-0" />
            Revisá el nombre: falta verbo en infinitivo.
          </p>
        )}
      </div>
      {present ? (
        <button
          type="button"
          onClick={() => dismiss(candidate.id)}
          aria-label={`Quitar "${candidate.name}" de la lista`}
          className="mt-0.5 h-6 w-6 shrink-0 rounded-control text-faint transition hover:bg-accent-soft hover:text-ink"
        >
          <X size={13} className="mx-auto" />
        </button>
      ) : (
        <button
          type="button"
          onClick={add}
          className="mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-control border border-line-strong px-1.5 text-[11px] font-medium text-ink transition hover:border-accent hover:text-accent"
        >
          <Plus size={11} />
          Agregar
        </button>
      )}
    </li>
  )
}

/**
 * Reads a requirements document and lines its capabilities up against the
 * canvas, so "what is still missing from the diagram" becomes a checklist
 * instead of a reading exercise.
 */
export default function RequirementsTab() {
  const candidates = useRequirements((state) => state.candidates)
  const sourceName = useRequirements((state) => state.sourceName)
  const extractorLabel = useRequirements((state) => state.extractorLabel)
  const importFromPicker = useRequirements((state) => state.importFromPicker)
  const clear = useRequirements((state) => state.clear)
  const nodes = useDocument((state) => state.nodes)

  const drawn = useMemo(() => {
    const names = new Set<string>()
    for (const node of nodes) {
      if (nodeKindOf(node) === 'useCase') names.add(normalizeName(node.data.label))
    }
    return names
  }, [nodes])

  if (candidates.length === 0) return <EmptyState />

  const present = candidates.filter((item) => drawn.has(normalizeName(item.name)))

  return (
    <>
      <ProgressBar
        passed={present.length}
        total={candidates.length}
        unit="casos de uso en el lienzo"
        doneLabel="Todo cubierto"
      />
      <div className="flex items-center justify-between px-3.5 pb-2">
        <span className="truncate text-[11px] text-faint">
          {sourceName}
          {extractorLabel && ` · ${extractorLabel}`}
        </span>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => void importFromPicker()}
            className="rounded-control px-1.5 py-0.5 text-[11px] text-muted transition hover:text-accent"
          >
            Otro archivo
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-control px-1.5 py-0.5 text-[11px] text-muted transition hover:text-danger"
          >
            Limpiar
          </button>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            present={drawn.has(normalizeName(candidate.name))}
          />
        ))}
      </ul>
    </>
  )
}
