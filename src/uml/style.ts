import { EDGE_SPECS, type UmlEdgeKind } from '../types/uml'

/** Visual state an element can be in, shared by the canvas and the exporter. */
export type ElementState = 'default' | 'selected' | 'flagged'

export const MARKER_SHAPES = ['open', 'triangle', 'filled'] as const
export type MarkerShape = (typeof MARKER_SHAPES)[number]

export const ELEMENT_STATES: readonly ElementState[] = [
  'default',
  'selected',
  'flagged',
]

export function markerId(shape: MarkerShape, state: ElementState): string {
  return `uml-marker-${shape}-${state}`
}

export interface EdgeVisual {
  strokeVar: string
  dashArray: string | undefined
  markerUrl: string | undefined
  strokeWidth: number
}

const STROKE_VAR: Record<ElementState, string> = {
  default: 'var(--uml-line)',
  selected: 'var(--app-accent)',
  flagged: 'var(--app-danger)',
}

export function edgeVisual(
  kind: UmlEdgeKind,
  state: ElementState = 'default',
): EdgeVisual {
  const spec = EDGE_SPECS[kind]
  return {
    strokeVar: STROKE_VAR[state],
    dashArray: spec.lineStyle === 'dashed' ? '7 5' : undefined,
    markerUrl:
      spec.marker === 'none'
        ? undefined
        : `url(#${markerId(spec.marker, state)})`,
    strokeWidth: state === 'default' ? 1.6 : 2.2,
  }
}

/**
 * Marker `<defs>` as markup, so the live canvas and the SVG export use exactly
 * the same arrowheads. `resolve` maps a CSS custom property to a literal colour
 * for the exporter; the canvas passes the variables straight through.
 */
export function markerDefs(
  resolve: (cssVar: string) => string = (value) => value,
  backgroundVar = 'var(--app-bg)',
): string {
  const background = resolve(backgroundVar)
  const parts: string[] = []

  for (const state of ELEMENT_STATES) {
    const stroke = resolve(STROKE_VAR[state])
    const common = `markerUnits="userSpaceOnUse" orient="auto-start-reverse"`

    // Open arrowhead: «include» / «extend».
    parts.push(
      `<marker id="${markerId('open', state)}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" ${common}>` +
        `<path d="M1,1 L11,6 L1,11" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</marker>`,
    )

    // Hollow triangle: generalization. Filled with the page background so the
    // line does not show through the triangle.
    parts.push(
      `<marker id="${markerId('triangle', state)}" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" ${common}>` +
        `<path d="M1,1 L13,7 L1,13 Z" fill="${background}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `</marker>`,
    )

    // Solid arrowhead: generic flow arrows.
    parts.push(
      `<marker id="${markerId('filled', state)}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" ${common}>` +
        `<path d="M1,1 L11,6 L1,11 Z" fill="${stroke}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>` +
        `</marker>`,
    )
  }

  return parts.join('')
}
