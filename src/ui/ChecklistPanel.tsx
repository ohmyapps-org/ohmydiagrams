import { AlertCircle, Check, CircleDashed, Wand2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { diagramType } from '../diagrams/registry'
import { useDocument } from '../store/document'
import type { ValidationFix, ValidationItem } from '../uml/validation'
import ProgressBar from './ProgressBar'
import RequirementsTab from './RequirementsTab'

export type ChecklistTab = 'validation' | 'guide' | 'requirements'

interface Props {
  tab: ChecklistTab
  onTabChange: (tab: ChecklistTab) => void
}

function FixButton({ fix }: { fix: ValidationFix }) {
  const reverseEdge = useDocument((state) => state.reverseEdge)
  const updateNodeData = useDocument((state) => state.updateNodeData)

  const run = (): void => {
    switch (fix.kind) {
      case 'reverseEdge':
        reverseEdge(fix.edgeId)
        break
      case 'renameNode':
        updateNodeData(fix.nodeId, { label: fix.value })
        break
      case 'focusMeta':
        document
          .querySelector<HTMLInputElement>('input[data-diagram-title]')
          ?.focus()
        break
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        run()
      }}
      className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-control border border-line-strong px-2 py-1 text-left text-[11.5px] font-medium text-ink transition hover:border-accent hover:text-accent"
    >
      <Wand2 size={12} className="shrink-0" />
      <span className="truncate">{fix.label}</span>
    </button>
  )
}

function ValidationRow({ item }: { item: ValidationItem }) {
  const selectOnly = useDocument((state) => state.selectOnly)
  const setFlagged = useDocument((state) => state.setFlagged)
  const flagged = useDocument(
    (state) =>
      item.elementIds.length > 0 &&
      item.elementIds.every((id) => state.ui.flagged.includes(id)),
  )

  const failed = item.status === 'fail'
  const idle = item.status === 'idle'
  const clickable = failed && item.elementIds.length > 0

  const focus = (): void => {
    if (!clickable) return
    // Highlighting doubles as selecting, so the properties panel follows along.
    setFlagged(flagged ? [] : item.elementIds)
    selectOnly(flagged ? [] : item.elementIds)
  }

  return (
    <li>
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={focus}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            focus()
          }
        }}
        className={`flex gap-2.5 rounded-control px-2.5 py-2 transition ${
          clickable ? 'cursor-pointer hover:bg-accent-soft' : ''
        } ${flagged ? 'bg-danger-soft' : ''}`}
      >
        <span className="mt-0.5 shrink-0">
          {failed ? (
            <AlertCircle size={15} className="text-danger" />
          ) : idle ? (
            <CircleDashed size={15} className="text-faint" />
          ) : (
            <Check size={15} className="text-ok" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[12.5px] leading-snug ${
              failed ? 'font-medium text-ink' : idle ? 'text-faint' : 'text-muted'
            }`}
          >
            <span className="mr-1 text-faint">{item.number}.</span>
            {item.title}
          </p>
          {failed ? (
            <>
              <p className="mt-0.5 text-[11.5px] leading-snug text-danger">
                {item.message}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
                {item.suggestion}
              </p>
              {item.fixes.map((fix, index) => (
                <FixButton key={`${item.id}-fix-${index}`} fix={fix} />
              ))}
            </>
          ) : (
            item.suggestion && (
              <p className="mt-0.5 text-[11.5px] leading-snug text-faint">
                {item.suggestion}
              </p>
            )
          )}
        </div>
      </div>
    </li>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-8 text-center text-[12.5px] leading-relaxed text-muted">
      {children}
    </p>
  )
}

function ValidationTab() {
  const kind = useDocument((state) => state.kind)
  const nodes = useDocument((state) => state.nodes)
  const edges = useDocument((state) => state.edges)
  const meta = useDocument((state) => state.meta)

  // Re-derived on every graph change: the canvas state alone decides the result.
  const report = useMemo(
    () => diagramType(kind).validate(nodes, edges, meta),
    [kind, nodes, edges, meta],
  )

  if (report.total === 0) {
    return (
      <Empty>
        {diagramType(kind).title} todavía no tiene reglas propias. Dibujá libre:
        se guarda, se exporta y se abre igual que cualquier otro diagrama.
      </Empty>
    )
  }

  return (
    <>
      {report.blank ? (
        <p className="px-3.5 pb-3 text-[12px] leading-relaxed text-muted">
          {report.total} reglas de UML 2.5 esperando. La validación arranca con
          el primer elemento del lienzo.
        </p>
      ) : (
        <ProgressBar passed={report.passed} total={report.total} />
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {report.items.map((item) => (
          <ValidationRow key={item.id} item={item} />
        ))}
      </ul>
    </>
  )
}

function GuideTab() {
  const kind = useDocument((state) => state.kind)
  const guideChecks = useDocument((state) => state.ui.guideChecks)
  const toggleGuideStep = useDocument((state) => state.toggleGuideStep)
  const steps = diagramType(kind).guide
  const done = steps.filter((step) => guideChecks[step.id]).length

  return (
    <>
      <ProgressBar
        passed={done}
        total={steps.length}
        unit="pasos"
        doneLabel="Guía completa"
      />
      <ol className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {steps.map((step, index) => {
          const checked = guideChecks[step.id] ?? false
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => toggleGuideStep(step.id)}
                className="flex w-full gap-2.5 rounded-control px-2.5 py-2 text-left transition hover:bg-accent-soft"
              >
                <span className="mt-0.5 shrink-0">
                  {checked ? (
                    <Check size={15} className="text-ok" />
                  ) : (
                    <CircleDashed size={15} className="text-faint" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[12.5px] font-medium leading-snug ${
                      checked ? 'text-muted line-through' : 'text-ink'
                    }`}
                  >
                    <span className="mr-1 text-faint">{index + 1}.</span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
                    {step.guidance}
                  </p>
                  <p className="mt-1 rounded-[5px] bg-accent-soft px-1.5 py-0.5 text-[11px] leading-snug text-accent">
                    {step.example}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </>
  )
}

export default function ChecklistPanel({ tab, onTabChange }: Props) {
  const type = diagramType(useDocument((state) => state.kind))

  // A kind without a guide, or one the requirements reader knows nothing
  // about, does not show those tabs at all.
  const tabs: { id: ChecklistTab; label: string }[] = [
    { id: 'validation', label: 'Validación' },
    ...(type.guide.length > 0 ? [{ id: 'guide' as const, label: 'Guía' }] : []),
    ...(type.requirements
      ? [{ id: 'requirements' as const, label: 'Requisitos' }]
      : []),
  ]
  const active = tabs.some((entry) => entry.id === tab) ? tab : 'validation'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1 border-b border-line p-1.5">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onTabChange(entry.id)}
            className={`flex-1 rounded-control px-3 py-1.5 text-[12.5px] font-medium transition ${
              active === entry.id
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:text-ink'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="requirements-table flex min-h-0 flex-1 flex-col pt-3">
        {active === 'validation' && <ValidationTab />}
        {active === 'guide' && <GuideTab />}
        {active === 'requirements' && <RequirementsTab />}
      </div>
    </div>
  )
}
