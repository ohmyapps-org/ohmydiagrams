import { useReactFlow, useStore } from '@xyflow/react'
import { Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { SHAPE_MIME } from '../canvas/dnd'
import { diagramType } from '../diagrams/registry'
import type { PaletteConnector, PaletteGroup, PaletteShape } from '../diagrams/types'
import { useDocument } from '../store/document'
import { EDGE_SPECS, NODE_SPECS, type UmlNodeKind } from '../types/uml'
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

function ShapeButton({ entry }: { entry: PaletteShape }) {
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
      <span className="text-faint">
        <entry.icon size={17} />
      </span>
      <span className="truncate">{spec.title}</span>
    </button>
  )
}

function ConnectorButton({ entry }: { entry: PaletteConnector }) {
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
      <span className={active ? 'text-accent' : 'text-faint'}>
        <entry.icon size={17} />
      </span>
      <span className="truncate">{spec.title}</span>
    </button>
  )
}

/** Keeps only what matches the search box, dropping groups left empty. */
function filterGroups(
  groups: readonly PaletteGroup[],
  filter: string,
): PaletteGroup[] {
  if (!filter) return [...groups]
  return groups
    .map((group) => ({
      title: group.title,
      shapes: group.shapes?.filter((entry) =>
        normalizeName(NODE_SPECS[entry.kind].title).includes(filter),
      ),
      connectors: group.connectors?.filter((entry) =>
        normalizeName(EDGE_SPECS[entry.kind].title).includes(filter),
      ),
    }))
    .filter(
      (group) =>
        (group.shapes?.length ?? 0) > 0 || (group.connectors?.length ?? 0) > 0,
    )
}

export default function Palette() {
  const [query, setQuery] = useState('')
  const kind = useDocument((state) => state.kind)
  const pendingEdgeKind = useDocument((state) => state.ui.pendingEdgeKind)

  const filter = normalizeName(query)
  const groups = useMemo(
    () => filterGroups(diagramType(kind).palette, filter),
    [kind, filter],
  )

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
        {groups.map((group) => (
          <section key={group.title} className="mb-4">
            <h3 className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
              {group.title}
            </h3>
            {group.shapes?.map((entry) => (
              <ShapeButton key={entry.kind} entry={entry} />
            ))}
            {group.connectors?.map((entry) => (
              <ConnectorButton key={entry.kind} entry={entry} />
            ))}
          </section>
        ))}

        {groups.length === 0 && (
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
