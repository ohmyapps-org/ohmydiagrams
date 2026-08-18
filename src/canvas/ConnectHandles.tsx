import { Handle, Position } from '@xyflow/react'

const POSITIONS: readonly Position[] = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
]

/**
 * Four compass handles per node. They are `source` handles only: the canvas
 * runs in loose connection mode, so each one also accepts incoming links, which
 * keeps a single dot per side instead of two stacked ones.
 *
 * Edge geometry ignores which handle was used — connectors float against the
 * node silhouette — so the handles are purely a grab target.
 */
export default function ConnectHandles({ nodeId }: { nodeId: string }) {
  return (
    <>
      {POSITIONS.map((position) => (
        <Handle
          key={position}
          id={`${nodeId}-${position}`}
          type="source"
          position={position}
          isConnectableStart
          isConnectableEnd
        />
      ))}
    </>
  )
}
