/**
 * Mermaid text to SVG, through pele. Everything that draws or checks a text
 * diagram goes through here: the preview, the exporters and the MCP bridge, so
 * an agent sees exactly the verdict a person sees.
 */

export interface MermaidDrawing {
  ok: true
  svg: string
  width: number
  height: number
  /** Diagram family pele detected: flowchart, sequence, class... */
  type: string
}

export interface MermaidFailure {
  ok: false
  /** `empty` is not an error to show, only a blank editor. */
  code: 'empty' | 'unsupported-diagram' | 'syntax' | 'semantic' | 'limit' | 'unknown'
  message: string
  /** 1-based; 0 when pele could not point at a place. */
  line: number
  column: number
  snippet: string
}

export type MermaidResult = MermaidDrawing | MermaidFailure

const FAILURE_CODES: readonly MermaidFailure['code'][] = [
  'unsupported-diagram',
  'syntax',
  'semantic',
  'limit',
]

/** Loaded on first use: pele is ~650 KB and most documents never need it. */
let peleModule: Promise<typeof import('pele/lazy')> | null = null

function loadPele(): Promise<typeof import('pele/lazy')> {
  peleModule ??= import('pele/lazy')
  return peleModule
}

function failure(error: unknown): MermaidFailure {
  const info = error as {
    code?: string
    message?: unknown
    line?: unknown
    column?: unknown
    snippet?: unknown
  }
  const code = FAILURE_CODES.find((item) => item === info?.code) ?? 'unknown'
  return {
    ok: false,
    code,
    message:
      typeof info?.message === 'string'
        ? info.message
        : 'No se pudo dibujar el diagrama.',
    line: typeof info?.line === 'number' ? info.line : 0,
    column: typeof info?.column === 'number' ? info.column : 0,
    snippet: typeof info?.snippet === 'string' ? info.snippet : '',
  }
}

export async function renderMermaid(source: string): Promise<MermaidResult> {
  if (source.trim() === '') {
    return { ok: false, code: 'empty', message: '', line: 0, column: 0, snippet: '' }
  }
  try {
    const { renderAsync } = await loadPele()
    const { svg, width, height, type } = await renderAsync(source)
    return { ok: true, svg, width, height, type }
  } catch (error) {
    return failure(error)
  }
}

/** One line a person or an agent can read to find the mistake. */
export function describeFailure(result: MermaidFailure): string {
  const where = result.line > 0 ? `Línea ${result.line}, columna ${result.column}: ` : ''
  return `${where}${result.message}`.trim()
}

/** The examples the empty editor offers; each one is valid. */
export const MERMAID_EXAMPLES: readonly { label: string; source: string }[] = [
  {
    label: 'Flujo',
    source: `flowchart TD
  start([Inicio]) --> check{¿Datos válidos?}
  check -- Sí --> save[Guardar]
  check -- No --> fix[Corregir]
  fix --> check
  save --> done([Fin])
`,
  },
  {
    label: 'Secuencia',
    source: `sequenceDiagram
  actor Cliente
  Cliente->>Tienda: Solicitar pedido
  Tienda->>Banco: Cobrar
  Banco-->>Tienda: Aprobado
  Tienda-->>Cliente: Confirmación
`,
  },
  {
    label: 'Clases',
    source: `classDiagram
  class Cliente {
    +String nombre
    +comprar()
  }
  class Pedido {
    +Date fecha
    +total() Number
  }
  Cliente "1" --> "*" Pedido : realiza
`,
  },
  {
    label: 'Estados',
    source: `stateDiagram-v2
  [*] --> Borrador
  Borrador --> Revisión : enviar
  Revisión --> Publicado : aprobar
  Revisión --> Borrador : rechazar
  Publicado --> [*]
`,
  },
  {
    label: 'Entidad-relación',
    source: `erDiagram
  CLIENTE ||--o{ PEDIDO : realiza
  PEDIDO ||--|{ LINEA : contiene
  PRODUCTO ||--o{ LINEA : aparece_en
`,
  },
]
