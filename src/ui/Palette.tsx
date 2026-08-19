import {
  ArrowRight,
  Circle,
  Diamond,
  Minus,
  Search,
  Square,
  StickyNote,
  Triangle,
  Type,
  User,
  Frame,
  Split,
} from 'lucide-react'
import { useReactFlow, useStore } from '@xyflow/react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { SHAPE_MIME } from '../canvas/dnd'
import { useDocument } from '../store/document'
import {
  EDGE_SPECS,
  NODE_SPECS,
  type UmlEdgeKind,
  type UmlNodeKind,
} from '../types/uml'
import type { Point } from '../uml/geometry'
import { avoidOverlap, centredOn } from '../uml/placement'
import { CONNECTION_HINTS } from '../uml/rules'
import { normalizeName } from '../uml/verbs'

/**
 * Clicking the palette drops the shape in the middle of what the user is
 * looking at, stepping aside when that spot is taken. Dragging still decides
 * the position by hand.
 */
function useDropPoint(): (kind: UmlNodeKind) => Point {
  const domNode = useStore((state) => state.domNode)
  const { screenToFlowPosition } = useReactFlow()

  return useCallback(
    (kind: UmlNodeKind) => {
      const box = domNode?.getBoundingClientRect()
      const centre = box
        ? screenToFlowPosition({
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
          })
        : { x: 0, y: 0 }
      return avoidOverlap(useDocument.getState().nodes, centredOn(kind, centre))
    },
    [domNode, screenToFlowPosition],
  )
}

interface ShapeEntry {
  kind: UmlNodeKind
  icon: ReactNode
  hint: string
}

interface ConnectorEntry {
  kind: UmlEdgeKind
  icon: ReactNode
}

const UML_SHAPES: readonly ShapeEntry[] = [
  { kind: 'actor', icon: <User size={17} />, hint: 'Entidad externa. Va fuera del límite.' },
  {
    kind: 'useCase',
    icon: <Circle size={17} />,
    hint: 'Función completa. Verbo en infinitivo + objeto.',
  },
  {
    kind: 'boundary',
    icon: <Frame size={17} />,
    hint: 'Encierra todos los casos de uso.',
  },
  { kind: 'note', icon: <StickyNote size={17} />, hint: 'Anotación libre.' },
]

const BASIC_SHAPES: readonly ShapeEntry[] = [
  { kind: 'rectangle', icon: <Square size={17} />, hint: 'Forma genérica.' },
  { kind: 'ellipse', icon: <Circle size={17} />, hint: 'Forma genérica.' },
  { kind: 'diamond', icon: <Diamond size={17} />, hint: 'Decisión en flujos ad-hoc.' },
  { kind: 'text', icon: <Type size={17} />, hint: 'Etiqueta suelta.' },
]

const UML_CONNECTORS: readonly ConnectorEntry[] = [
  { kind: 'association', icon: <Minus size={17} /> },
  { kind: 'include', icon: <ArrowRight size={17} /> },
  { kind: 'extend', icon: <ArrowRight size={17} /> },
  { kind: 'generalization', icon: <Triangle size={17} /> },
]

const BASIC_CONNECTORS: readonly ConnectorEntry[] = [
  { kind: 'noteLink', icon: <Split size={17} /> },
  { kind: 'arrow', icon: <ArrowRight size={17} /> },
]

function ShapeButton({ entry }: { entry: ShapeEntry }) {
  const spec = NODE_SPECS[entry.kind]
  const addNode = useDocument((state) => state.addNode)
  const dropPoint = useDropPoint()

  return (
    <button
      type="button"
      draggable
      title={entry.hint}
      onDragStart={(event) => {
        event.dataTransfer.setData(SHAPE_MIME, entry.kind)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      // Click drops the shape in a readable spot for keyboard-first users.
      onClick={() => addNode(entry.kind, dropPoint(entry.kind))}
      className="flex w-full cursor-grab items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] text-ink transition hover:bg-accent-soft active:cursor-grabbing"
    >
      <span className="text-faint">{entry.icon}</span>
      <span className="truncate">{spec.title}</span>
    </button>
  )
}

function ConnectorButton({ entry }: { entry: ConnectorEntry }) {
  const spec = EDGE_SPECS[entry.kind]
  const active = useDocument((state) => state.ui.pendingEdgeKind === entry.kind)
  const setUi = useDocument((state) => state.setUi)

  return (
    <button
      type="button"
      title={CONNECTION_HINTS[entry.kind]}
      onClick={() => setUi({ pendingEdgeKind: entry.kind })}
      className={`flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] transition ${
        active
          ? 'bg-accent-soft font-medium text-accent'
          : 'text-ink hover:bg-accent-soft'
      }`}
    >
      <span className={active ? 'text-accent' : 'text-faint'}>{entry.icon}</span>
      <span className="truncate">{spec.title}</span>
    </button>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function Palette() {
  const [query, setQuery] = useState('')
  const pendingEdgeKind = useDocument((state) => state.ui.pendingEdgeKind)

  const filter = normalizeName(query)

  const matches = useMemo(() => {
    const shapeMatches = (entry: ShapeEntry): boolean =>
      !filter || normalizeName(NODE_SPECS[entry.kind].title).includes(filter)
    const connectorMatches = (entry: ConnectorEntry): boolean =>
      !filter || normalizeName(EDGE_SPECS[entry.kind].title).includes(filter)

    return {
      umlShapes: UML_SHAPES.filter(shapeMatches),
      umlConnectors: UML_CONNECTORS.filter(connectorMatches),
      basicShapes: BASIC_SHAPES.filter(shapeMatches),
      basicConnectors: BASIC_CONNECTORS.filter(connectorMatches),
    }
  }, [filter])

  const empty =
    matches.umlShapes.length === 0 &&
    matches.umlConnectors.length === 0 &&
    matches.basicShapes.length === 0 &&
    matches.basicConnectors.length === 0

  return (
    <aside className="glass flex h-full w-60 shrink-0 flex-col rounded-panel">
      <div className="relative border-b border-line p-2.5">
        <Search
          size={14}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar forma"
          aria-label="Buscar forma"
          className="w-full rounded-control border border-line bg-surface/60 py-1.5 pl-7 pr-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-3">
        {matches.umlShapes.length > 0 && (
          <Group title="UML Use Case">
            {matches.umlShapes.map((entry) => (
              <ShapeButton key={entry.kind} entry={entry} />
            ))}
          </Group>
        )}

        {matches.umlConnectors.length > 0 && (
          <Group title="Relaciones UML">
            {matches.umlConnectors.map((entry) => (
              <ConnectorButton key={entry.kind} entry={entry} />
            ))}
          </Group>
        )}

        {matches.basicShapes.length > 0 && (
          <Group title="Básicas">
            {matches.basicShapes.map((entry) => (
              <ShapeButton key={entry.kind} entry={entry} />
            ))}
          </Group>
        )}

        {matches.basicConnectors.length > 0 && (
          <Group title="Conectores básicos">
            {matches.basicConnectors.map((entry) => (
              <ConnectorButton key={entry.kind} entry={entry} />
            ))}
          </Group>
        )}

        {empty && (
          <p className="px-2.5 py-6 text-center text-[13px] text-faint">
            Sin resultados para "{query}".
          </p>
        )}
      </div>

      <div className="border-t border-line px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
        <span className="font-medium text-ink">
          {EDGE_SPECS[pendingEdgeKind].title}
        </span>
        <br />
        {CONNECTION_HINTS[pendingEdgeKind]}
      </div>
    </aside>
  )
}
