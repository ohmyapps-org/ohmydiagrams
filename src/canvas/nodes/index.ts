import type { NodeTypes } from '@xyflow/react'
import ActorNode from './ActorNode'
import BoundaryNode from './BoundaryNode'
import NoteNode from './NoteNode'
import ShapeNode from './ShapeNode'
import TextNode from './TextNode'
import UseCaseNode from './UseCaseNode'

export const nodeTypes: NodeTypes = {
  actor: ActorNode,
  useCase: UseCaseNode,
  boundary: BoundaryNode,
  note: NoteNode,
  text: TextNode,
  rectangle: ShapeNode,
  ellipse: ShapeNode,
  diamond: ShapeNode,
}
