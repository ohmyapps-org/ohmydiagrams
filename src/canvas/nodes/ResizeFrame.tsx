import {
  NodeResizeControl,
  ResizeControlVariant,
  type ControlLinePosition,
  type ControlPosition,
} from '@xyflow/react'
import { NODE_SPECS, type UmlNodeKind } from '../../types/uml'
import { useDocument } from '../../store/document'

interface Props {
  kind: UmlNodeKind
  selected: boolean
}

/** The four sides, each grabbable along its whole length. */
const LINES: readonly ControlLinePosition[] = ['top', 'right', 'bottom', 'left']

const CORNERS: readonly ControlPosition[] = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
]

/**
 * Transform box around the selected node: every side is grabbable along its
 * whole length, not only the four corners. There is deliberately no grip at
 * each side's midpoint — that is where the connection handle lives, and two
 * different gestures on one pixel is worse than none. Every resize folds into
 * a single undo step.
 */
export default function ResizeFrame({ kind, selected }: Props) {
  const spec = NODE_SPECS[kind]
  const beginTransaction = useDocument((state) => state.beginTransaction)
  const endTransaction = useDocument((state) => state.endTransaction)

  if (!spec.resizable || !selected) return null

  const shared = {
    minWidth: spec.minWidth,
    minHeight: spec.minHeight,
    keepAspectRatio: spec.keepAspectRatio,
    onResizeStart: beginTransaction,
    onResizeEnd: endTransaction,
  }

  return (
    <>
      {LINES.map((position) => (
        <NodeResizeControl
          key={`line-${position}`}
          position={position}
          variant={ResizeControlVariant.Line}
          className="uml-resize-line"
          {...shared}
        />
      ))}
      {CORNERS.map((position) => (
        <NodeResizeControl
          key={`corner-${position}`}
          position={position}
          className="uml-resize-grip"
          {...shared}
        />
      ))}
    </>
  )
}
