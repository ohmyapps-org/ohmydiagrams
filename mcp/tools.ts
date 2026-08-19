import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { EDGE_SPECS, NODE_SPECS, type UmlEdgeKind, type UmlNodeKind } from '../src/types/uml'
import type { CanvasBridge } from './bridge'

const NODE_KINDS = Object.keys(NODE_SPECS) as [UmlNodeKind, ...UmlNodeKind[]]
const EDGE_KINDS = Object.keys(EDGE_SPECS) as [UmlEdgeKind, ...UmlEdgeKind[]]

const point = z.object({ x: z.number(), y: z.number() })

/** MCP wants text content; the canvas answers in plain objects. */
function ok(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

function failed(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: error instanceof Error ? error.message : 'Falló la llamada al lienzo.',
      },
    ],
  }
}

/** Wraps a tool body so a rejected rule reads as a message, not a crash. */
function guard<T>(run: () => Promise<T>) {
  return run().then(ok).catch(failed)
}

export function registerTools(server: McpServer, bridge: CanvasBridge): void {
  server.registerTool(
    'get_diagram',
    {
      title: 'Leer el diagrama',
      description:
        'Devuelve el diagrama abierto en el lienzo: título, descripción, y cada nodo y relación con su id, tipo, etiqueta y posición. Empezá siempre por acá antes de modificar nada.',
      inputSchema: {},
    },
    () => guard(() => bridge.call('getDiagram', {})),
  )

  server.registerTool(
    'get_validation',
    {
      title: 'Ver la checklist UML',
      description:
        'Evalúa las 17 reglas de UML 2.5 contra el diagrama abierto y devuelve cuáles pasan, cuáles fallan, por qué y qué elementos están involucrados.',
      inputSchema: {},
    },
    () => guard(() => bridge.call('getValidation', {})),
  )

  server.registerTool(
    'add_node',
    {
      title: 'Agregar una forma',
      description:
        'Agrega una forma al lienzo. Los casos de uso se nombran con verbo en infinitivo más objeto ("Registrar venta"). Los actores van fuera del límite del sistema y los casos de uso adentro. Sin posición, la forma se ubica a la derecha de lo que ya existe.',
      inputSchema: {
        kind: z.enum(NODE_KINDS).describe('Tipo de forma'),
        label: z.string().optional().describe('Texto de la forma'),
        position: point.optional().describe('Coordenadas del lienzo, esquina superior izquierda'),
      },
    },
    ({ kind, label, position }) =>
      guard(() => bridge.call('addNode', { kind, label, position })),
  )

  server.registerTool(
    'add_edge',
    {
      title: 'Conectar dos elementos',
      description:
        'Crea una relación. "association" va de un actor a un caso de uso; "include" del caso base al incluido; "extend" del caso que extiende al caso base; "generalization" del hijo al padre. Si la combinación viola UML 2.5 la llamada falla y explica la regla.',
      inputSchema: {
        kind: z.enum(EDGE_KINDS).describe('Tipo de relación'),
        source: z.string().describe('Id del elemento de origen'),
        target: z.string().describe('Id del elemento de destino'),
      },
    },
    ({ kind, source, target }) =>
      guard(() => bridge.call('addEdge', { kind, source, target })),
  )

  server.registerTool(
    'update_node',
    {
      title: 'Renombrar o mover una forma',
      description: 'Cambia la etiqueta y/o la posición de una forma existente.',
      inputSchema: {
        id: z.string(),
        label: z.string().optional(),
        position: point.optional(),
      },
    },
    ({ id, label, position }) =>
      guard(() => bridge.call('updateNode', { id, label, position })),
  )

  server.registerTool(
    'delete_elements',
    {
      title: 'Eliminar elementos',
      description:
        'Elimina nodos y relaciones por id. Al borrar un nodo se borran también sus relaciones.',
      inputSchema: { ids: z.array(z.string()).min(1) },
    },
    ({ ids }) => guard(() => bridge.call('deleteElements', { ids })),
  )

  server.registerTool(
    'set_meta',
    {
      title: 'Poner título y descripción',
      description:
        'Define el título del diagrama (la regla 16 lo exige) y su descripción, que se incluyen en las exportaciones.',
      inputSchema: {
        title: z.string().optional(),
        description: z.string().optional(),
      },
    },
    ({ title, description }) =>
      guard(() => bridge.call('setMeta', { title, description })),
  )

  server.registerTool(
    'insert_skeleton',
    {
      title: 'Insertar el esqueleto de ejemplo',
      description:
        'Inserta un diagrama base: límite del sistema, un actor afuera, tres casos de uso adentro y sus asociaciones. Útil como punto de partida antes de adaptarlo al dominio.',
      inputSchema: { center: point.optional() },
    },
    ({ center }) => guard(() => bridge.call('insertSkeleton', { center })),
  )

  server.registerTool(
    'clear_diagram',
    {
      title: 'Vaciar el lienzo',
      description:
        'Borra todo el diagrama. La acción queda en el historial, así que el usuario puede deshacerla con ⌘Z.',
      inputSchema: {},
    },
    () => guard(() => bridge.call('clear', {})),
  )
}
