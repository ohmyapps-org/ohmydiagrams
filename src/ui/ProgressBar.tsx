interface Props {
  passed: number
  total: number
  /** Text next to the counter; shown only when everything is done. */
  doneLabel?: string
  unit?: string
}

export default function ProgressBar({
  passed,
  total,
  doneLabel = 'Diagrama válido',
  unit = 'verificaciones',
}: Props) {
  const ratio = total === 0 ? 0 : passed / total
  const complete = total > 0 && passed === total

  return (
    <div className="px-3.5 pb-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] text-muted">
          {passed} de {total} {unit}
        </span>
        {complete && (
          <span className="text-[12px] font-medium text-ok">{doneLabel}</span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${ratio * 100}%`,
            background: complete ? 'var(--app-ok)' : 'var(--app-accent)',
          }}
        />
      </div>
    </div>
  )
}
