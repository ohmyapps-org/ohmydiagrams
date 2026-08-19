import type { ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useDocument } from '../store/document'
import {
  EDGE_SPECS,
  NODE_SPECS,
  type LineStyle,
  type UmlEdgeKind,
  type UmlNodeKind,
  edgeKindOf,
  nodeKindOf,
} from '../types/uml'

const NODE_KINDS: readonly UmlNodeKind[] = [
  'actor',
  'useCase',
  'boundary',
  'note',
  'rectangle',
  'ellipse',
  'diamond',
  'text',
]

const EDGE_KINDS: readonly UmlEdgeKind[] = [
  'association',
  'include',
  'extend',
  'generalization',
  'noteLink',
  'arrow',
]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-control border border-line bg-surface/60 px-2 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent'

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: string | null
  fallback: string
  onChange: (value: string | null) => void
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? fallback}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-control border border-line bg-transparent p-0.5"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={value === null}
          className="rounded-control border border-line px-2 py-1.5 text-[12px] text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Por defecto
        </button>
      </div>
    </Field>
  )
}

function DocumentProperties() {
  const meta = useDocument((state) => state.meta)
  const setMeta = useDocument((state) => state.setMeta)
  const nodes = useDocument((state) => state.nodes)
  const edges = useDocument((state) => state.edges)

  return (
    <div className="p-3.5">
      <h3 className="text-[12.5px] font-semibold text-ink">Documento</h3>
      {/* Read-only: the title has a single editor, in the top bar. */}
      <p className="mb-2.5 mt-0.5 truncate text-[11.5px] text-faint" title={meta.title}>
        {meta.title.trim() || 'Sin título'} · se renombra en la barra superior
      </p>
      <Field label="Descripción">
        <textarea
          value={meta.description}
          onChange={(event) => setMeta({ description: event.target.value })}
          placeholder="Contexto del diagrama. Se incluye en las exportaciones."
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </Field>
      <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
        {nodes.length} elemento(s) y {edges.length} relación(es). Seleccioná algo
        en el lienzo para editar sus propiedades.
      </p>
    </div>
  )
}

function NodeProperties({ id }: { id: string }) {
  const node = useDocument((state) => state.nodes.find((item) => item.id === id))
  const updateNodeData = useDocument((state) => state.updateNodeData)
  const updateNodeKind = useDocument((state) => state.updateNodeKind)
  if (!node) return null

  const kind = nodeKindOf(node)

  return (
    <div className="p-3.5">
      <h3 className="mb-2.5 text-[12.5px] font-semibold text-ink">
        {NODE_SPECS[kind].title}
      </h3>

      <Field label="Nombre">
        <input
          value={node.data.label}
          onChange={(event) => updateNodeData(id, { label: event.target.value })}
          className={inputClass}
        />
      </Field>

      <Field label="Tipo de elemento">
        <select
          value={kind}
          onChange={(event) =>
            updateNodeKind(id, event.target.value as UmlNodeKind)
          }
          className={inputClass}
        >
          {NODE_KINDS.map((option) => (
            <option key={option} value={option}>
              {NODE_SPECS[option].title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tamaño de fuente">
        <input
          type="number"
          min={8}
          max={48}
          value={node.data.fontSize}
          onChange={(event) =>
            updateNodeData(id, { fontSize: Number(event.target.value) || 14 })
          }
          className={inputClass}
        />
      </Field>

      <Field label="Estilo de línea">
        <select
          value={node.data.lineStyle}
          onChange={(event) =>
            updateNodeData(id, { lineStyle: event.target.value as LineStyle })
          }
          className={inputClass}
        >
          <option value="solid">Sólida</option>
          <option value="dashed">Punteada</option>
        </select>
      </Field>

      <ColorField
        label="Relleno"
        value={node.data.fill}
        fallback="#ffffff"
        onChange={(fill) => updateNodeData(id, { fill })}
      />
      <ColorField
        label="Trazo y texto"
        value={node.data.stroke}
        fallback="#1a1d21"
        onChange={(stroke) => updateNodeData(id, { stroke })}
      />
    </div>
  )
}

function EdgeProperties({ id }: { id: string }) {
  const edge = useDocument((state) => state.edges.find((item) => item.id === id))
  const updateEdgeData = useDocument((state) => state.updateEdgeData)
  const updateEdgeKind = useDocument((state) => state.updateEdgeKind)
  const reverseEdge = useDocument((state) => state.reverseEdge)
  const setEdgeWaypoints = useDocument((state) => state.setEdgeWaypoints)
  if (!edge?.data) return null

  const kind = edgeKindOf(edge)

  return (
    <div className="p-3.5">
      <h3 className="mb-2.5 text-[12.5px] font-semibold text-ink">
        Relación · {EDGE_SPECS[kind].title}
      </h3>

      <Field label="Tipo de relación">
        <select
          value={kind}
          onChange={(event) =>
            updateEdgeKind(id, event.target.value as UmlEdgeKind)
          }
          className={inputClass}
        >
          {EDGE_KINDS.map((option) => (
            <option key={option} value={option}>
              {EDGE_SPECS[option].title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Etiqueta">
        <input
          value={edge.data.label}
          onChange={(event) => updateEdgeData(id, { label: event.target.value })}
          placeholder="Sin etiqueta"
          className={inputClass}
        />
      </Field>

      <Field label="Tamaño de fuente">
        <input
          type="number"
          min={8}
          max={32}
          value={edge.data.fontSize}
          onChange={(event) =>
            updateEdgeData(id, { fontSize: Number(event.target.value) || 12 })
          }
          className={inputClass}
        />
      </Field>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => reverseEdge(id)}
          className="flex-1 rounded-control border border-line px-2 py-1.5 text-[12px] text-ink transition hover:border-accent hover:text-accent"
        >
          Invertir dirección
        </button>
        <button
          type="button"
          onClick={() => setEdgeWaypoints(id, [])}
          disabled={edge.data.waypoints.length === 0}
          className="flex-1 rounded-control border border-line px-2 py-1.5 text-[12px] text-ink transition hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Enderezar
        </button>
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
        Doble clic sobre la línea agrega un punto de quiebre; doble clic sobre un
        punto lo elimina.
      </p>
    </div>
  )
}

export default function PropertiesPanel() {
  // useShallow: these selectors build fresh arrays on every store change.
  const selectedNodes = useDocument(
    useShallow((state) =>
      state.nodes.filter((node) => node.selected).map((node) => node.id),
    ),
  )
  const selectedEdges = useDocument(
    useShallow((state) =>
      state.edges.filter((edge) => edge.selected).map((edge) => edge.id),
    ),
  )

  const total = selectedNodes.length + selectedEdges.length

  if (total === 0) return <DocumentProperties />

  if (total > 1) {
    return (
      <div className="p-3.5">
        <h3 className="mb-1.5 text-[12.5px] font-semibold text-ink">
          {total} elementos seleccionados
        </h3>
        <p className="text-[11.5px] leading-relaxed text-muted">
          Usá las herramientas de alineación de la barra superior, o seleccioná
          un solo elemento para editar sus propiedades.
        </p>
      </div>
    )
  }

  const nodeId = selectedNodes[0]
  return nodeId ? (
    <NodeProperties id={nodeId} />
  ) : (
    <EdgeProperties id={selectedEdges[0]!} />
  )
}
