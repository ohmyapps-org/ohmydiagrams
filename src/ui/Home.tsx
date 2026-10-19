import { Copy, FileText, FileUp, FolderOpen, Info, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { DIAGRAM_LIST, diagramType } from '../diagrams/registry'
import { importJson } from '../export'
import { useLibrary } from '../store/library'
import type { DiagramType } from '../diagrams/types'
import type { LibraryEntry, SpecEntry } from '../types/document'
import ConnectionsMenu from './ConnectionsMenu'
import Skeleton from './Skeleton'
import ThemeButton from './ThemeButton'

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60_000],
  ['hour', 3_600_000],
  ['day', 86_400_000],
  ['week', 604_800_000],
  ['month', 2_629_800_000],
  ['year', 31_557_600_000],
]

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** "hace 3 días", in the largest unit that still reads naturally. */
function when(timestamp: number): string {
  const elapsed = Date.now() - timestamp
  if (elapsed < 60_000) return 'recién'
  let chosen: [Intl.RelativeTimeFormatUnit, number] = UNITS[0]
  for (const unit of UNITS) if (elapsed >= unit[1]) chosen = unit
  return relative.format(-Math.round(elapsed / chosen[1]), chosen[0])
}

function KindBadge({ type }: { type: DiagramType }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
      <type.icon size={11} />
      {type.title}
    </span>
  )
}

function NewCard({ type }: { type: DiagramType }) {
  const createDiagram = useLibrary((state) => state.createDiagram)

  return (
    <button
      type="button"
      onClick={() => createDiagram(type.kind)}
      className="glass-card flex flex-col items-start gap-1.5 rounded-panel p-4 text-left"
    >
      <span className="flex w-full items-center justify-between">
        <type.icon size={20} className="text-accent" strokeWidth={1.6} />
        {!type.ready && (
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] font-medium text-faint">
            sin reglas todavía
          </span>
        )}
      </span>
      <span className="text-[13.5px] font-semibold text-ink">{type.title}</span>
      <span className="text-[11.5px] leading-snug text-muted">{type.description}</span>
    </button>
  )
}

function DiagramCard({ entry }: { entry: LibraryEntry }) {
  const openDiagram = useLibrary((state) => state.openDiagram)
  const duplicateDiagram = useLibrary((state) => state.duplicateDiagram)
  const deleteDiagram = useLibrary((state) => state.deleteDiagram)
  const type = diagramType(entry.kind)
  const title = entry.title.trim() || 'Sin título'

  return (
    <div className="glass-card group flex flex-col rounded-panel">
      <button
        type="button"
        onClick={() => openDiagram(entry.id)}
        className="flex min-w-0 flex-1 flex-col items-start gap-1.5 p-4 text-left"
      >
        <KindBadge type={type} />
        <span className="w-full truncate text-[13.5px] font-semibold text-ink">
          {title}
        </span>
        <span className="text-[11.5px] text-muted">
          {entry.kind === 'text'
            ? `${entry.lineCount ?? 0} línea(s) de Mermaid`
            : `${entry.nodeCount} elemento(s) · ${entry.edgeCount} relación(es)`}
        </span>
        <span className="text-[11px] text-faint">Editado {when(entry.updatedAt)}</span>
      </button>
      <div className="flex justify-end gap-1 border-t border-line px-2 py-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          title="Duplicar"
          aria-label={`Duplicar ${title}`}
          onClick={() => duplicateDiagram(entry.id)}
          className="flex h-7 w-7 items-center justify-center rounded-control text-muted transition hover:bg-accent-soft hover:text-accent"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          title="Borrar"
          aria-label={`Borrar ${title}`}
          onClick={() => {
            if (window.confirm(`¿Borrar "${title}"? No se puede deshacer.`)) {
              deleteDiagram(entry.id)
            }
          }}
          className="flex h-7 w-7 items-center justify-center rounded-control text-muted transition hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function SpecRow({ spec }: { spec: SpecEntry }) {
  const removeSpec = useLibrary((state) => state.removeSpec)

  return (
    <li className="flex items-center gap-2.5 rounded-control px-2.5 py-2 transition hover:bg-accent-soft">
      <FileText size={15} className="shrink-0 text-faint" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink">{spec.name}</span>
        <span className="block text-[11px] text-faint">
          {when(spec.importedAt)} ·{' '}
          {spec.text
            ? `${Math.max(1, Math.round(spec.length / 1000))} mil caracteres`
            : 'demasiado grande para guardar el texto'}
        </span>
      </span>
      <button
        type="button"
        title="Quitar"
        aria-label={`Quitar ${spec.name}`}
        onClick={() => removeSpec(spec.id)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted transition hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={14} />
      </button>
    </li>
  )
}

/** Placeholder row for the file currently being read. */
function SpecRowSkeleton() {
  return (
    <li
      role="status"
      aria-busy="true"
      aria-label="Leyendo el archivo"
      className="flex items-center gap-2.5 px-2.5 py-2"
    >
      <Skeleton className="h-[15px] w-[15px] shrink-0 rounded-[3px]" />
      <span className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-[60%]" />
        <Skeleton className="h-2.5 w-[35%]" />
      </span>
    </li>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const secondaryButton =
  'inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2.5 py-1.5 text-[12px] font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-50'

export default function Home() {
  const entries = useLibrary((state) => state.entries)
  const specs = useLibrary((state) => state.specs)
  const importingSpec = useLibrary((state) => state.importingSpec)
  const importSpecFromPicker = useLibrary((state) => state.importSpecFromPicker)

  const recent = [...entries].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              Oh My Diagrams
            </h1>
            <p className="mt-0.5 text-[13px] text-muted">
              Tus diagramas y tus especificaciones, guardados en este navegador.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeButton />
            <ConnectionsMenu />
          </div>
        </header>

        <Section title="Nuevo diagrama">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {DIAGRAM_LIST.map((type) => (
              <NewCard key={type.kind} type={type} />
            ))}
          </div>
        </Section>

        <Section
          title={`Tus diagramas (${entries.length})`}
          action={
            <button type="button" className={secondaryButton} onClick={() => void importJson()}>
              <FolderOpen size={13} />
              Abrir un JSON
            </button>
          }
        >
          {recent.length === 0 ? (
            <p className="glass rounded-panel px-4 py-6 text-center text-[13px] text-muted">
              Todavía no guardaste ninguno. Empezá por una tarjeta de arriba.
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((entry) => (
                <DiagramCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </Section>

        <Section
          title={`Requisitos (${specs.length})`}
          action={
            <button
              type="button"
              className={secondaryButton}
              disabled={importingSpec}
              onClick={() => void importSpecFromPicker()}
            >
              <FileUp size={13} />
              {importingSpec ? 'Leyendo…' : 'Importar PDF, Markdown o TXT'}
            </button>
          }
        >
          {specs.length === 0 && !importingSpec ? (
            <p className="glass rounded-panel px-4 py-6 text-center text-[13px] text-muted">
              Importá una especificación y queda acá, lista para leerla desde
              cualquier diagrama.
            </p>
          ) : (
            <ul className="glass rounded-panel p-1.5">
              {importingSpec && <SpecRowSkeleton />}
              {specs.map((spec) => (
                <SpecRow key={spec.id} spec={spec} />
              ))}
            </ul>
          )}
        </Section>

        <p className="flex items-center gap-1.5 text-[11.5px] text-faint">
          <Info size={12} />
          Todo vive en este navegador. Exportá el JSON para llevarte un diagrama
          a otra máquina.
        </p>
      </div>
    </div>
  )
}
