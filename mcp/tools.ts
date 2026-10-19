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
        'Sólo para diagramas dibujados (no de texto). Devuelve el diagrama abierto en el lienzo: título, descripción, y cada nodo y relación con su id, tipo, etiqueta y posición. Empezá siempre por acá antes de modificar nada.',
      inputSchema: {},
    },
    () => guard(() => bridge.call('getDiagram', {})),
  )

  server.registerTool(
    'get_source',
    {
      title: 'Leer el texto Mermaid',
      description:
        'Sólo para diagramas de tipo texto. Devuelve el título, el texto Mermaid completo y si dibuja: valid, el tipo de diagrama detectado y, si falla, el error con línea y columna. Empezá por acá antes de reescribir nada.',
      inputSchema: {},
    },
    () => guard(() => bridge.call('getSource', {})),
  )

  server.registerTool(
    'set_source',
    {
      title: 'Escribir el texto Mermaid',
      description:
        'Sólo para diagramas de tipo texto. Reemplaza el texto Mermaid completo; el usuario ve el dibujo al instante. Devuelve el veredicto de pele: valid, diagram, y si falla error con línea y columna. Si valid es false el texto igual queda guardado, así que corregilo y volvé a llamar hasta que dibuje. Tipos soportados: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram y el resto de Mermaid 12.1.',
      inputSchema: {
        source: z.string().describe('Texto Mermaid completo del diagrama'),
      },
    },
    ({ source }) => guard(() => bridge.call('setSource', { source })),
  )

  server.registerTool(
    'get_validation',
    {
      title: 'Ver la checklist UML',
      description:
        'Evalúa las reglas UML del tipo de diagrama abierto y devuelve cuáles pasan, cuáles fallan, por qué y qué elementos están involucrados.',
      inputSchema: {},
    },
    () => guard(() => bridge.call('getValidation', {})),
  )

  server.registerTool(
    'add_node',
    {
      title: 'Agregar una forma',
      description:
        'Agrega una forma al lienzo. En casos de uso: verbo en infinitivo más objeto ("Registrar venta"), actores fuera del límite. En clases: sustantivo con mayúscula inicial ("Cliente"). Sin posición, la forma se ubica a la derecha de lo que ya existe.',
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
        'Crea una relación. Si viola UML 2.5 la llamada falla y explica la regla. Casos de uso: association actor→caso, include del base al incluido, extend del que extiende al base, generalization del hijo al padre. Clases: aggregation/composition del todo a la parte, realization de la clase a la interfaz.',
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
      description:
        'Cambia la etiqueta, la posición y, en clasificadores, los atributos u operaciones (un string por línea).',
      inputSchema: {
        id: z.string(),
        label: z.string().optional(),
        position: point.optional(),
        attributes: z.array(z.string()).optional(),
        operations: z.array(z.string()).optional(),
      },
    },
    ({ id, label, position, attributes, operations }) =>
      guard(() =>
        bridge.call('updateNode', { id, label, position, attributes, operations }),
      ),
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
        'Inserta el diagrama de ejemplo del tipo abierto. En casos de uso: límite, un actor y tres casos. En clases: Cliente, Pedido, LineaPedido y Producto con asociación y composición.',
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
