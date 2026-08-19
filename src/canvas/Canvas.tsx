import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  ReactFlow,
  useReactFlow,
  type Connection,
  type FinalConnectionState,
  type IsValidConnection,
  type OnConnect,
} from '@xyflow/react'
import { useCallback, useRef, useState } from 'react'
import { useDocument } from '../store/document'
import { useTheme } from '../store/theme'
import { toast } from '../store/toasts'
import {
  edgeKindOf,
  isUmlNodeKind,
  type UmlEdge,
  type UmlNode,
  type UmlNodeKind,
} from '../types/uml'
import { GRID_SIZE, type Point } from '../uml/geometry'
import { centredOn } from '../uml/placement'
import { canConnect, orientConnection } from '../uml/rules'
import { createUseCaseSkeleton } from '../uml/templates'
import ContextMenu, { type ContextMenuTarget } from './ContextMenu'
import EmptyState from './EmptyState'
import Markers from './Markers'
import QuickMenu, { type QuickMenuTarget } from './QuickMenu'
import { SHAPE_MIME } from './dnd'
import { edgeTypes } from './edges'
import { nodeTypes } from './nodes'

interface Props {
  onOpenGuide: () => void
}

const SNAP_GRID: [number, number] = [GRID_SIZE, GRID_SIZE]

/**
 * Right dragging pans the canvas and ends with a `contextmenu` event, so the
 * menu only opens when the pointer barely moved between press and release.
 */
const PAN_SLOP_PX = 4

export default function Canvas({ onOpenGuide }: Props) {
  const wrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const [menu, setMenu] = useState<ContextMenuTarget | null>(null)
  const [quickMenu, setQuickMenu] = useState<QuickMenuTarget | null>(null)
  /** Flow coordinates of the click that opened the quick menu. */
  const quickMenuPoint = useRef<Point>({ x: 0, y: 0 })
  /** Where the right button went down, to tell a click from a pan. */
  const rightPress = useRef<Point | null>(null)

  const nodes = useDocument((state) => state.nodes)
  const edges = useDocument((state) => state.edges)
  const snapToGrid = useDocument((state) => state.ui.snapToGrid)
  const showGrid = useDocument((state) => state.ui.showGrid)
  const pendingEdgeKind = useDocument((state) => state.ui.pendingEdgeKind)
  const theme = useTheme((state) => state.theme)

  const onNodesChange = useDocument((state) => state.onNodesChange)
  const onEdgesChange = useDocument((state) => state.onEdgesChange)
  const beginTransaction = useDocument((state) => state.beginTransaction)
  const endTransaction = useDocument((state) => state.endTransaction)
  const addNode = useDocument((state) => state.addNode)
  const addEdge = useDocument((state) => state.addEdge)
  const setUi = useDocument((state) => state.setUi)
  const insertFragment = useDocument((state) => state.insertFragment)
  const canPaste = useDocument((state) => state.clipboard !== null)

  const findNode = useCallback(
    (id: string | null | undefined): UmlNode | undefined =>
      id ? useDocument.getState().nodes.find((node) => node.id === id) : undefined,
    [],
  )

  /** Shared by the live connection preview and the commit path. */
  const verdictFor = useCallback(
    (connection: Connection | UmlEdge) => {
      const source = findNode(connection.source)
      const target = findNode(connection.target)
      if (!source || !target) return { ok: false as const, reason: undefined }
      return canConnect(pendingEdgeKind, source, target)
    },
    [findNode, pendingEdgeKind],
  )

  const isValidConnection = useCallback<IsValidConnection<UmlEdge>>(
    (connection) => verdictFor(connection).ok,
    [verdictFor],
  )

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      const source = findNode(connection.source)
      const target = findNode(connection.target)
      if (!source || !target) return

      const verdict = canConnect(pendingEdgeKind, source, target)
      if (!verdict.ok) {
        // Teach the rule instead of silently refusing.
        if (verdict.reason) toast.error(verdict.reason)
        return
      }

      const oriented = orientConnection(pendingEdgeKind, source, target)
      const duplicate = useDocument
        .getState()
        .edges.some(
          (edge) =>
            edgeKindOf(edge) === pendingEdgeKind &&
            edge.source === oriented.source.id &&
            edge.target === oriented.target.id,
        )
      if (duplicate) {
        toast.info('Esa relación ya existe entre esos dos elementos.')
        return
      }

      addEdge(pendingEdgeKind, oriented.source.id, oriented.target.id)
    },
    [findNode, pendingEdgeKind, addEdge],
  )

  /**
   * `isValidConnection` makes React Flow refuse the drop before `onConnect`
   * ever runs, so the teaching moment has to live here: `onConnectEnd` fires
   * for rejected attempts too.
   */
  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      const source = findNode(state.fromNode?.id)
      const target = findNode(state.toNode?.id)
      // No target means the user let go over empty canvas: nothing to explain.
      if (!source || !target) return

      const verdict = canConnect(pendingEdgeKind, source, target)
      if (!verdict.ok && verdict.reason) toast.error(verdict.reason)
    },
    [findNode, pendingEdgeKind],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData(SHAPE_MIME)
      if (!kind || !isUmlNodeKind(kind)) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addNode(kind, position)
    },
    [screenToFlowPosition, addNode],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const openMenu = useCallback(
    (kind: 'node' | 'edge') =>
      (event: React.MouseEvent, element: { id: string }) => {
        event.preventDefault()
        setQuickMenu(null)
        setMenu({ x: event.clientX, y: event.clientY, kind, id: element.id })
      },
    [],
  )

  const closeMenu = useCallback(() => {
    setMenu(null)
    setQuickMenu(null)
  }, [])

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    rightPress.current =
      event.button === 2 ? { x: event.clientX, y: event.clientY } : null
  }, [])

  /**
   * Right click on empty canvas: the quick menu at the cursor. React Flow
   * swallows `onPaneContextMenu` whenever `panOnDrag` includes the right
   * button, so the event is picked up here on the wrapper instead.
   */
  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!(event.target as HTMLElement).classList.contains('react-flow__pane')) {
        return
      }
      const press = rightPress.current
      if (
        press &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > PAN_SLOP_PX
      ) {
        return
      }
      event.preventDefault()
      setMenu(null)
      quickMenuPoint.current = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      setQuickMenu({ x: event.clientX, y: event.clientY })
    },
    [screenToFlowPosition],
  )

  /** Double click on empty canvas: drop a text label ready to type into. */
  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Nodes live inside the pane, so only a direct hit counts as "empty".
      if (!(event.target as HTMLElement).classList.contains('react-flow__pane')) {
        return
      }
      closeMenu()
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const node = addNode('text', centredOn('text', point), '')
      setUi({ editingId: node.id })
    },
    [addNode, closeMenu, screenToFlowPosition, setUi],
  )

  const quickCreate = useCallback(
    (kind: UmlNodeKind) => {
      addNode(kind, centredOn(kind, quickMenuPoint.current))
      setQuickMenu(null)
    },
    [addNode],
  )

  const quickSkeleton = useCallback(() => {
    insertFragment(createUseCaseSkeleton(quickMenuPoint.current))
    setQuickMenu(null)
  }, [insertFragment])

  const menuAction = useCallback(
    (run: (id: string) => void) => () => {
      if (!menu) return
      run(menu.id)
      setMenu(null)
    },
    [menu],
  )

  const store = useDocument.getState

  return (
    <div
      ref={wrapper}
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      <Markers />
      <ReactFlow<UmlNode, UmlEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        onNodeDragStart={beginTransaction}
        onNodeDragStop={endTransaction}
        onSelectionDragStart={beginTransaction}
        onSelectionDragStop={endTransaction}
        onNodeContextMenu={openMenu('node')}
        onEdgeContextMenu={openMenu('edge')}
        onPaneClick={closeMenu}
        onMoveStart={closeMenu}
        // Deletion, copy/paste and undo all run through the store so they share
        // one history stack; React Flow's built-ins are switched off.
        deleteKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        selectionKeyCode={null}
        colorMode={theme}
        connectionMode={ConnectionMode.Loose}
        // Double click drops a text label instead of zooming.
        zoomOnDoubleClick={false}
        // Generous snap radius so dropping anywhere on a shape connects to it,
        // instead of demanding a pixel-accurate hit on a handle dot.
        connectionRadius={70}
        connectionLineType={ConnectionLineType.Straight}
        connectionLineStyle={{
          stroke: 'var(--app-accent)',
          strokeWidth: 2,
          strokeDasharray: '6 4',
        }}
        snapToGrid={snapToGrid}
        snapGrid={SNAP_GRID}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        zoomOnScroll
        zoomOnPinch
        minZoom={0.15}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={GRID_SIZE * 2}
            size={1}
            color="var(--uml-grid)"
          />
        )}
      </ReactFlow>

      {nodes.length === 0 && <EmptyState onOpenGuide={onOpenGuide} />}

      {quickMenu && (
        <QuickMenu
          target={quickMenu}
          canPaste={canPaste}
          onClose={closeMenu}
          onSkeleton={quickSkeleton}
          onCreate={quickCreate}
          onPaste={() => {
            store().paste()
            setQuickMenu(null)
          }}
        />
      )}

      {menu && (
        <ContextMenu
          target={menu}
          onClose={closeMenu}
          onEditLabel={menuAction((id) => setUi({ editingId: id }))}
          onDuplicate={menuAction((id) => {
            store().selectOnly([id])
            store().duplicateSelection()
          })}
          onBringToFront={menuAction((id) => store().bringToFront([id]))}
          onSendToBack={menuAction((id) => store().sendToBack([id]))}
          onReverse={menuAction((id) => store().reverseEdge(id))}
          onDelete={menuAction((id) => {
            store().selectOnly([id])
            store().deleteSelection()
          })}
        />
      )}
    </div>
  )
}
