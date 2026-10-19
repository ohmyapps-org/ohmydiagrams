import {
  ArrowRight,
  Box,
  Boxes,
  Circle,
  ClipboardCheck,
  FileCode,
  Diamond,
  Frame,
  Gem,
  Layers,
  List,
  Minus,
  Split,
  Square,
  StickyNote,
  Triangle,
  Type,
  User,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import type { DiagramKind } from '../types/document'
import { DIAGRAM_KINDS } from '../types/document'
import type { UmlEdge, UmlNode } from '../types/uml'
import { validateClass } from '../uml/classValidation'
import { CLASS_GUIDE_STEPS, GUIDE_STEPS } from '../uml/guide'
import { validate } from '../uml/validation'
import type { DiagramType, PaletteGroup } from './types'

const BASIC_SHAPES = [
  { kind: 'rectangle', icon: Square, hint: 'Forma genérica.' },
  { kind: 'ellipse', icon: Circle, hint: 'Forma genérica.' },
  { kind: 'diamond', icon: Diamond, hint: 'Decisión.' },
  { kind: 'text', icon: Type, hint: 'Etiqueta suelta.' },
  { kind: 'note', icon: StickyNote, hint: 'Anotación libre.' },
] as const

const BASIC_CONNECTORS = [
  { kind: 'arrow', icon: ArrowRight },
  { kind: 'noteLink', icon: Split },
] as const

const BASIC_GROUPS: readonly PaletteGroup[] = [
  { title: 'Formas', shapes: BASIC_SHAPES },
  { title: 'Conectores', connectors: BASIC_CONNECTORS },
]

const USE_CASE_GROUPS: readonly PaletteGroup[] = [
  {
    title: 'UML Use Case',
    shapes: [
      { kind: 'actor', icon: User, hint: 'Entidad externa. Va fuera del límite.' },
      {
        kind: 'useCase',
        icon: Circle,
        hint: 'Función completa. Verbo en infinitivo + objeto.',
      },
      { kind: 'boundary', icon: Frame, hint: 'Encierra todos los casos de uso.' },
      { kind: 'note', icon: StickyNote, hint: 'Anotación libre.' },
    ],
  },
  {
    title: 'Relaciones UML',
    connectors: [
      { kind: 'association', icon: Minus },
      { kind: 'include', icon: ArrowRight },
      { kind: 'extend', icon: ArrowRight },
      { kind: 'generalization', icon: Triangle },
    ],
  },
  {
    title: 'Básicas',
    shapes: [
      { kind: 'rectangle', icon: Square, hint: 'Forma genérica.' },
      { kind: 'ellipse', icon: Circle, hint: 'Forma genérica.' },
      { kind: 'diamond', icon: Diamond, hint: 'Decisión en flujos ad-hoc.' },
      { kind: 'text', icon: Type, hint: 'Etiqueta suelta.' },
    ],
  },
  { title: 'Conectores básicos', connectors: BASIC_CONNECTORS },
]

const CLASS_GROUPS: readonly PaletteGroup[] = [
  {
    title: 'UML Clase',
    shapes: [
      {
        kind: 'class',
        icon: Box,
        hint: 'Clasificador con nombre, atributos y operaciones.',
      },
      {
        kind: 'interface',
        icon: Layers,
        hint: 'Contrato. Una clase lo realiza con el conector de realización.',
      },
      {
        kind: 'enumeration',
        icon: List,
        hint: 'Conjunto cerrado de literales. Van en el compartimento de atributos.',
      },
      { kind: 'note', icon: StickyNote, hint: 'Anotación libre.' },
    ],
  },
  {
    title: 'Relaciones UML',
    connectors: [
      { kind: 'association', icon: Minus },
      { kind: 'aggregation', icon: Diamond },
      { kind: 'composition', icon: Gem },
      { kind: 'generalization', icon: Triangle },
      { kind: 'realization', icon: Triangle },
      { kind: 'dependency', icon: ArrowRight },
    ],
  },
  {
    title: 'Básicas',
    shapes: [
      { kind: 'rectangle', icon: Square, hint: 'Forma genérica.' },
      { kind: 'ellipse', icon: Circle, hint: 'Forma genérica.' },
      { kind: 'diamond', icon: Diamond, hint: 'Decisión en flujos ad-hoc.' },
      { kind: 'text', icon: Type, hint: 'Etiqueta suelta.' },
    ],
  },
  { title: 'Conectores básicos', connectors: BASIC_CONNECTORS },
]

/** A kind with no notation of its own has nothing to check, only to draw. */
function noRules(nodes: readonly UmlNode[], edges: readonly UmlEdge[]) {
  return {
    items: [],
    passed: 0,
    total: 0,
    blank: nodes.length === 0 && edges.length === 0,
  }
}

export const DIAGRAM_TYPES: Record<DiagramKind, DiagramType> = {
  useCase: {
    kind: 'useCase',
    title: 'Casos de uso',
    description:
      'UML 2.5 con la checklist en vivo: actores, casos de uso y límite del sistema.',
    icon: Users,
    ready: true,
    emptyHint:
      'Arrastrá actores y casos de uso desde la paleta de la izquierda. La validación de la derecha te va marcando en vivo lo que falta para que el diagrama cumpla UML 2.5.',
    palette: USE_CASE_GROUPS,
    guide: GUIDE_STEPS,
    requirements: true,
    defaultEdgeKind: 'association',
    validate,
  },
  class: {
    kind: 'class',
    title: 'Clases',
    description:
      'UML 2.5 con la checklist en vivo: clases, interfaces, herencia, agregación y composición.',
    icon: Boxes,
    ready: true,
    emptyHint:
      'Arrastrá clases desde la paleta de la izquierda. La validación de la derecha te va marcando en vivo lo que falta para que el diagrama cumpla UML 2.5.',
    palette: CLASS_GROUPS,
    guide: CLASS_GUIDE_STEPS,
    requirements: false,
    defaultEdgeKind: 'association',
    validate: validateClass,
  },
  flow: {
    kind: 'flow',
    title: 'Flujo',
    description: 'Procesos paso a paso con decisiones y ramas.',
    icon: Workflow,
    ready: false,
    emptyHint:
      'Arrastrá formas desde la paleta de la izquierda. Este tipo de diagrama todavía no tiene reglas propias: se guarda y se exporta igual.',
    palette: BASIC_GROUPS,
    guide: [],
    requirements: false,
    defaultEdgeKind: 'arrow',
    validate: noRules,
  },
  qa: {
    kind: 'qa',
    title: 'QA',
    description: 'Casos de prueba y cobertura de escenarios.',
    icon: ClipboardCheck,
    ready: false,
    emptyHint:
      'Arrastrá formas desde la paleta de la izquierda. Este tipo de diagrama todavía no tiene reglas propias: se guarda y se exporta igual.',
    palette: BASIC_GROUPS,
    guide: [],
    requirements: false,
    defaultEdgeKind: 'arrow',
    validate: noRules,
  },
  automation: {
    kind: 'automation',
    title: 'Automatización',
    description: 'Disparadores, condiciones y acciones encadenadas.',
    icon: Zap,
    ready: false,
    emptyHint:
      'Arrastrá formas desde la paleta de la izquierda. Este tipo de diagrama todavía no tiene reglas propias: se guarda y se exporta igual.',
    palette: BASIC_GROUPS,
    guide: [],
    requirements: false,
    defaultEdgeKind: 'arrow',
    validate: noRules,
  },
  text: {
    kind: 'text',
    title: 'Texto (Mermaid)',
    description:
      'Escribí el diagrama como texto Mermaid y se dibuja al instante. Ideal para que lo escriba una IA.',
    icon: FileCode,
    ready: true,
    emptyHint: '',
    palette: [],
    guide: [],
    requirements: false,
    defaultEdgeKind: 'arrow',
    validate: noRules,
  },
}

export const DIAGRAM_LIST: readonly DiagramType[] = DIAGRAM_KINDS.map(
  (kind) => DIAGRAM_TYPES[kind],
)

export function diagramType(kind: DiagramKind): DiagramType {
  return DIAGRAM_TYPES[kind]
}
