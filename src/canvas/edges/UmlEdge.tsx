import {
  EdgeLabelRenderer,
  useInternalNode,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'
import { useCallback, useMemo, useState } from 'react'
import { useDocument } from '../../store/document'
import type { UmlEdge as UmlEdgeType, UmlNode } from '../../types/uml'
import {
  bendInsertIndex,
  buildEdgeGeometry,
  buildSelfLoopGeometry,
  closestPointOnSegment,
  snap,
  type Point,
} from '../../uml/geometry'
import { edgeVisual, type ElementState } from '../../uml/style'
import EditableLabel from '../EditableLabel'

/**
 * One component for every UML relation. It routes against the node silhouettes
 * (floating edges) rather than against handle positions, which is what makes
 * connectors stay glued to ellipses and stick figures — and lets the SVG
 * exporter reproduce the exact same path.
 */
export default function UmlEdge({ id, source, target, data, selected }: EdgeProps<UmlEdgeType>) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const { screenToFlowPosition } = useReactFlow()

  const flagged = useDocument((state) => state.ui.flagged.includes(id))
  const snapToGrid = useDocument((state) => state.ui.snapToGrid)
  const setEdgeWaypoints = useDocument((state) => state.setEdgeWaypoints)
  const updateEdgeData = useDocument((state) => state.updateEdgeData)
  const beginTransaction = useDocument((state) => state.beginTransaction)
  const endTransaction = useDocument((state) => state.endTransaction)

  const editing = useDocument((state) => state.ui.editingId === id)
  const setUi = useDocument((state) => state.setUi)
  const setEditing = useCallback(
    (next: boolean) => setUi({ editingId: next ? id : null }),
    [id, setUi],
  )
  const [draggingBend, setDraggingBend] = useState<number | null>(null)

  const kind = data?.kind ?? 'association'
  const waypoints = useMemo(() => data?.waypoints ?? [], [data?.waypoints])

  const geometry = useMemo(() => {
    if (!sourceNode || !targetNode) return null
    // `useInternalNode` hands back the live, measured node — cast is safe
    // because every node in this canvas is a UmlNode.
    const from = sourceNode as unknown as UmlNode
    const to = targetNode as unknown as UmlNode
    return source === target
      ? buildSelfLoopGeometry(from)
      : buildEdgeGeometry(from, to, waypoints)
  }, [sourceNode, targetNode, source, target, waypoints])

  const toFlow = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      return snapToGrid ? { x: snap(point.x), y: snap(point.y) } : point
    },
    [screenToFlowPosition, snapToGrid],
  )

  const addBend = useCallback(
    (event: React.MouseEvent) => {
      if (!geometry || source === target) return
      event.stopPropagation()
      const point = toFlow(event)
      const index = bendInsertIndex(geometry.points, point)
      const anchored = closestPointOnSegment(
        geometry.points[index]!,
        geometry.points[index + 1]!,
        point,
      )
      const next = [...waypoints]
      next.splice(index, 0, snapToGrid
        ? { x: snap(anchored.x), y: snap(anchored.y) }
        : anchored)
      beginTransaction()
      setEdgeWaypoints(id, next)
      endTransaction()
    },
    [
      geometry,
      source,
      target,
      toFlow,
      waypoints,
      snapToGrid,
      beginTransaction,
      setEdgeWaypoints,
      endTransaction,
      id,
    ],
  )

  const startBendDrag = useCallback(
    (index: number) => (event: React.PointerEvent) => {
      event.stopPropagation()
      event.preventDefault()
      ;(event.target as Element).setPointerCapture?.(event.pointerId)
      beginTransaction()
      setDraggingBend(index)
    },
    [beginTransaction],
  )

  const moveBend = useCallback(
    (event: React.PointerEvent) => {
      if (draggingBend === null) return
      const next = [...waypoints]
      next[draggingBend] = toFlow(event)
      setEdgeWaypoints(id, next)
    },
    [draggingBend, waypoints, toFlow, setEdgeWaypoints, id],
  )

  const endBendDrag = useCallback(() => {
    if (draggingBend === null) return
    setDraggingBend(null)
    endTransaction()
  }, [draggingBend, endTransaction])

  const removeBend = useCallback(
    (index: number) => (event: React.MouseEvent) => {
      event.stopPropagation()
      beginTransaction()
      setEdgeWaypoints(id, waypoints.filter((_, i) => i !== index))
      endTransaction()
    },
    [beginTransaction, setEdgeWaypoints, id, waypoints, endTransaction],
  )

  if (!geometry) return null

  const state: ElementState = flagged ? 'flagged' : selected ? 'selected' : 'default'
  const visual = edgeVisual(kind, state)
  const label = data?.label ?? ''

  return (
    <>
      {/* Wide invisible stroke: the real click/double-click target. */}
      <path
        className="uml-edge-hit react-flow__edge-interaction"
        d={geometry.path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        onDoubleClick={addBend}
      />
      <path
        className="uml-edge-path"
        d={geometry.path}
        fill="none"
        stroke={visual.strokeVar}
        strokeWidth={visual.strokeWidth}
        strokeDasharray={visual.dashArray}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={visual.markerUrl}
        markerStart={visual.startMarkerUrl}
        pointerEvents="none"
      />

      {selected &&
        waypoints.map((point, index) => (
          <circle
            key={`${id}-bend-${index}`}
            className="nodrag nopan cursor-grab"
            cx={point.x}
            cy={point.y}
            r={5}
            fill="var(--app-surface)"
            stroke="var(--app-accent)"
            strokeWidth={1.6}
            onPointerDown={startBendDrag(index)}
            onPointerMove={moveBend}
            onPointerUp={endBendDrag}
            onPointerCancel={endBendDrag}
            onDoubleClick={removeBend(index)}
          />
        ))}

      {(label || editing) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${geometry.labelPoint.x}px, ${geometry.labelPoint.y}px)`,
            }}
            onDoubleClick={(event) => {
              event.stopPropagation()
              setEditing(true)
            }}
          >
            <div
              className="rounded-[4px] px-1"
              style={{
                background: 'var(--app-bg)',
                color: state === 'default' ? 'var(--uml-line)' : visual.strokeVar,
                minWidth: editing ? 96 : undefined,
              }}
            >
              <EditableLabel
                value={label}
                onCommit={(value) => updateEdgeData(id, { label: value })}
                editing={editing}
                onEditingChange={setEditing}
                fontSize={data?.fontSize ?? 12}
                placeholder=""
              />
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
