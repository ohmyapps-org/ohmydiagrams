import { MousePointerSquareDashed, ListChecks } from 'lucide-react'

interface Props {
  onOpenGuide: () => void
}

export default function EmptyState({ onOpenGuide }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="glass pointer-events-auto max-w-sm rounded-panel px-7 py-6 text-center">
        <MousePointerSquareDashed
          className="mx-auto mb-3 text-accent"
          size={30}
          strokeWidth={1.5}
        />
        <h2 className="mb-1.5 text-base font-semibold text-ink">
          Empezá tu diagrama de casos de uso
        </h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Arrastrá actores y casos de uso desde la paleta de la izquierda. La
          validación de la derecha te va marcando en vivo lo que falta para que
          el diagrama cumpla UML 2.5.
        </p>
        <button
          type="button"
          onClick={onOpenGuide}
          className="mt-4 inline-flex items-center gap-2 rounded-control border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink transition hover:border-accent hover:text-accent"
        >
          <ListChecks size={15} />
          Ver la guía paso a paso
        </button>
      </div>
    </div>
  )
}
