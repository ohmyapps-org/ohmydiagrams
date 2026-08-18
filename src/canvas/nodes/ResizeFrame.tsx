import { NodeResizer } from '@xyflow/react'
import { NODE_SPECS, type UmlNodeKind } from '../../types/uml'
import { useDocument } from '../../store/document'

interface Props {
  kind: UmlNodeKind
  selected: boolean
}

/**
 * Resize handles that fold the whole gesture into a single undo step.
 */
export default function ResizeFrame({ kind, selected }: Props) {
  const spec = NODE_SPECS[kind]
  const beginTransaction = useDocument((state) => state.beginTransaction)
  const endTransaction = useDocument((state) => state.endTransaction)

  if (!spec.resizable) return null

  return (
    <NodeResizer
      isVisible={selected}
      minWidth={spec.minWidth}
      minHeight={spec.minHeight}
      keepAspectRatio={spec.keepAspectRatio}
      onResizeStart={beginTransaction}
      onResizeEnd={endTransaction}
      lineClassName="!border-accent"
      handleClassName="!h-2 !w-2 !rounded-[2px] !border-accent !bg-surface"
    />
  )
}
