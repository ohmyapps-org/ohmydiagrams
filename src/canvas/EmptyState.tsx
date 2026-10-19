import { ListChecks, MousePointerSquareDashed } from 'lucide-react'
import { diagramType } from '../diagrams/registry'
import { useDocument } from '../store/document'

interface Props {
  onOpenGuide: () => void
}

export default function EmptyState({ onOpenGuide }: Props) {
  const kind = useDocument((state) => state.kind)
  const type = diagramType(kind)

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="select-none glass pointer-events-auto max-w-sm rounded-panel px-7 py-6 text-center">
        <MousePointerSquareDashed
          className="mx-auto mb-3 text-accent"
          size={30}
          strokeWidth={1.5}
        />
        <h2 className="mb-1.5 text-base font-semibold text-ink">
          Empezá tu diagrama de {type.title.toLowerCase()}
        </h2>
        <p className="text-[13px] leading-relaxed text-muted">{type.emptyHint}</p>
        {type.guide.length > 0 && (
          <button
            type="button"
            onClick={onOpenGuide}
            className="mt-4 inline-flex items-center gap-2 rounded-control border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink transition hover:border-accent hover:text-accent"
          >
            <ListChecks size={15} />
            Ver la guía paso a paso
          </button>
        )}
      </div>
    </div>
  )
}
