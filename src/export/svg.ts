import {
  EDGE_SPECS,
  NODE_SPECS,
  classifierStereotype,
  memberLines,
  type UmlDocument,
  type UmlEdge,
  type UmlNode,
  edgeKindOf,
  nodeKindOf,
} from '../types/uml'
import {
  boundsOf,
  buildEdgeGeometry,
  buildSelfLoopGeometry,
  nodeRect,
  padRect,
  rectCenter,
  type Rect,
} from '../uml/geometry'
import { markerDefs, markerId } from '../uml/style'
import { SVG_FONT_STACK, escapeXml, measureText, wrapText } from './text'

/**
 * Exports always use the light palette. A diagram pasted into a report or a
 * slide deck should read as ink on paper regardless of the theme the user was
 * drawing in.
 */
const PALETTE = {
  background: '#ffffff',
  ink: '#1a1d21',
  line: '#3f4650',
  muted: '#6b7280',
  useCaseFill: '#ffffff',
  boundaryFill: '#f7f9fc',
  boundaryStroke: '#94a3b8',
  noteFill: '#fffdf2',
  noteStroke: '#d8cfa8',
  shapeFill: '#ffffff',
  classFill: '#ffffff',
} as const

const LINE_HEIGHT = 1.25
const ACTOR_LABEL_STRIP = 22
const BOUNDARY_HEADER = 38
const NOTE_FOLD = 16
const CAPTION_GAP = 16

export interface SvgExportOptions {
  /** Blank margin around the drawing. */
  padding?: number
  /** `null` renders a transparent background. */
  background?: string | null
  /** Render the document title (and description) above the diagram. */
  includeCaption?: boolean
}

/** Resolves the light-palette colour for a CSS custom property used on canvas. */
function resolveVar(cssVar: string): string {
  const map: Record<string, string> = {
    'var(--uml-line)': PALETTE.line,
    'var(--uml-ink)': PALETTE.ink,
    'var(--app-accent)': PALETTE.line,
    'var(--app-danger)': PALETTE.line,
    'var(--app-bg)': PALETTE.background,
    'var(--uml-usecase-fill)': PALETTE.useCaseFill,
    'var(--uml-boundary-fill)': PALETTE.boundaryFill,
    'var(--uml-boundary-stroke)': PALETTE.boundaryStroke,
    'var(--uml-note-fill)': PALETTE.noteFill,
    'var(--uml-note-stroke)': PALETTE.noteStroke,
    'var(--app-surface)': PALETTE.shapeFill,
    'var(--uml-shape-fill)': PALETTE.shapeFill,
    'var(--uml-class-fill)': PALETTE.classFill,
  }
  return map[cssVar] ?? cssVar
}

/** Node colours: an explicit user override wins, otherwise the kind's default. */
function inkOf(node: UmlNode, fallback: string): string {
  return node.data.stroke ? resolveVar(node.data.stroke) : fallback
}

function fillOf(node: UmlNode, fallback: string): string {
  return node.data.fill ? resolveVar(node.data.fill) : fallback
}

function dashOf(node: UmlNode): string {
  return node.data.lineStyle === 'dashed' ? ' stroke-dasharray="6 4"' : ''
}

/* -------------------------------------------------------------------------- */
/* Text blocks                                                                */
/* -------------------------------------------------------------------------- */

interface TextBlockOptions {
  x: number
  y: number
  maxWidth: number
  fontSize: number
  fill: string
  anchor?: 'start' | 'middle'
  bold?: boolean
  italic?: boolean
  /** Vertical anchor: 'middle' centres the block on `y`, 'top' starts at `y`. */
  baseline?: 'middle' | 'top'
}

function textBlock(text: string, options: TextBlockOptions): string {
  const value = text.trim()
  if (!value) return ''

  const {
    x,
    y,
    maxWidth,
    fontSize,
    fill,
    anchor = 'middle',
    bold = false,
    italic = false,
    baseline = 'middle',
  } = options

  const lines = wrapText(value, maxWidth, fontSize, bold)
  const lineHeight = fontSize * LINE_HEIGHT
  const blockHeight = lines.length * lineHeight
  // Centre the block, then drop to the first line's alphabetic baseline.
  const first =
    (baseline === 'middle' ? y - blockHeight / 2 : y) + fontSize * 0.82

  const spans = lines
    .map(
      (line, index) =>
        `<tspan x="${x.toFixed(2)}" y="${(first + index * lineHeight).toFixed(2)}">${escapeXml(line)}</tspan>`,
    )
    .join('')

  return `<text font-family="${SVG_FONT_STACK}" font-size="${fontSize}" ${
    bold ? 'font-weight="600" ' : ''
  }${italic ? 'font-style="italic" ' : ''}fill="${fill}" text-anchor="${anchor}">${spans}</text>`
}

/* -------------------------------------------------------------------------- */
/* Node renderers — one per canvas component                                  */
/* -------------------------------------------------------------------------- */

function renderActor(node: UmlNode, rect: Rect): string {
  const stroke = inkOf(node, PALETTE.ink)
  const figureHeight = Math.max(rect.height - ACTOR_LABEL_STRIP, 10)
  // Mirrors preserveAspectRatio="xMidYMid meet" on a 60x84 viewBox.
  const scale = Math.min(rect.width / 60, figureHeight / 84)
  const offsetX = rect.x + (rect.width - 60 * scale) / 2
  const offsetY = rect.y + (figureHeight - 84 * scale) / 2

  const figure =
    `<g transform="translate(${offsetX.toFixed(2)},${offsetY.toFixed(2)}) scale(${scale.toFixed(4)})" ` +
    `fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="30" cy="13" r="11"/>` +
    `<path d="M30 24 L30 52"/>` +
    `<path d="M9 34 L51 34"/>` +
    `<path d="M30 52 L13 80"/>` +
    `<path d="M30 52 L47 80"/>` +
    `</g>`

  const label = textBlock(node.data.label, {
    x: rectCenter(rect).x,
    y: rect.y + figureHeight,
    maxWidth: Math.max(rect.width * 2.2, 120),
    fontSize: node.data.fontSize,
    fill: stroke,
    baseline: 'top',
  })

  return figure + label
}

function renderUseCase(node: UmlNode, rect: Rect): string {
  const centre = rectCenter(rect)
  const stroke = inkOf(node, PALETTE.ink)
  const ellipse =
    `<ellipse cx="${centre.x.toFixed(2)}" cy="${centre.y.toFixed(2)}" ` +
    `rx="${(rect.width / 2).toFixed(2)}" ry="${(rect.height / 2).toFixed(2)}" ` +
    `fill="${fillOf(node, PALETTE.useCaseFill)}" stroke="${stroke}" stroke-width="1.6"${dashOf(node)}/>`

  const label = textBlock(node.data.label, {
    x: centre.x,
    y: centre.y,
    // Matches the px-5 padding of the canvas component.
    maxWidth: rect.width - 40,
    fontSize: node.data.fontSize,
    fill: stroke,
  })

  return ellipse + label
}

function renderBoundary(node: UmlNode, rect: Rect): string {
  const stroke = inkOf(node, PALETTE.boundaryStroke)
  const box =
    `<rect x="${rect.x.toFixed(2)}" y="${rect.y.toFixed(2)}" ` +
    `width="${rect.width.toFixed(2)}" height="${rect.height.toFixed(2)}" rx="10" ` +
    `fill="${fillOf(node, PALETTE.boundaryFill)}" stroke="${stroke}" stroke-width="1.6"${dashOf(node)}/>`

  const divider =
    `<path d="M${rect.x.toFixed(2)},${(rect.y + BOUNDARY_HEADER).toFixed(2)} ` +
    `H${(rect.x + rect.width).toFixed(2)}" stroke="${stroke}" stroke-width="1.6" fill="none"/>`

  const label = textBlock(node.data.label, {
    x: rectCenter(rect).x,
    y: rect.y + BOUNDARY_HEADER / 2,
    maxWidth: rect.width - 32,
    fontSize: node.data.fontSize,
    fill: PALETTE.ink,
    bold: true,
  })

  return box + divider + label
}

function renderNote(node: UmlNode, rect: Rect): string {
  const stroke = inkOf(node, PALETTE.noteStroke)
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height

  const body =
    `<path d="M${rect.x},${rect.y} H${right - NOTE_FOLD} L${right},${rect.y + NOTE_FOLD} ` +
    `V${bottom} H${rect.x} Z" fill="${fillOf(node, PALETTE.noteFill)}" stroke="${stroke}" stroke-width="1.4"${dashOf(node)}/>`

  const fold =
    `<path d="M${right - NOTE_FOLD},${rect.y} L${right},${rect.y + NOTE_FOLD} ` +
    `L${right - NOTE_FOLD},${rect.y + NOTE_FOLD} Z" fill="${stroke}" fill-opacity="0.35" stroke="${stroke}" stroke-width="1"/>`

  const label = textBlock(node.data.label, {
    x: rect.x + 8,
    y: rect.y + 8,
    maxWidth: rect.width - 16,
    fontSize: node.data.fontSize,
    fill: PALETTE.ink,
    anchor: 'start',
    baseline: 'top',
  })

  return body + fold + label
}

function renderGenericShape(node: UmlNode, rect: Rect): string {
  const kind = nodeKindOf(node)
  const stroke = inkOf(node, PALETTE.ink)
  const fill = fillOf(node, PALETTE.shapeFill)
  const centre = rectCenter(rect)
  const dash = dashOf(node)
  let shape = ''

  if (kind === 'ellipse') {
    shape =
      `<ellipse cx="${centre.x.toFixed(2)}" cy="${centre.y.toFixed(2)}" ` +
      `rx="${(rect.width / 2 - 1).toFixed(2)}" ry="${(rect.height / 2 - 1).toFixed(2)}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="1.6"${dash}/>`
  } else if (kind === 'diamond') {
    const points = [
      `${centre.x},${rect.y + 1}`,
      `${rect.x + rect.width - 1},${centre.y}`,
      `${centre.x},${rect.y + rect.height - 1}`,
      `${rect.x + 1},${centre.y}`,
    ].join(' ')
    shape = `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"${dash}/>`
  } else if (kind === 'rectangle') {
    shape =
      `<rect x="${(rect.x + 1).toFixed(2)}" y="${(rect.y + 1).toFixed(2)}" ` +
      `width="${(rect.width - 2).toFixed(2)}" height="${(rect.height - 2).toFixed(2)}" rx="2" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="1.6"${dash}/>`
  }

  const label = textBlock(node.data.label, {
    x: centre.x,
    y: centre.y,
    maxWidth: rect.width - 24,
    fontSize: node.data.fontSize,
    fill: stroke,
  })

  return shape + label
}

function renderText(node: UmlNode, rect: Rect): string {
  const centre = rectCenter(rect)
  return textBlock(node.data.label, {
    x: centre.x,
    y: centre.y,
    maxWidth: rect.width,
    fontSize: node.data.fontSize,
    fill: inkOf(node, PALETTE.ink),
  })
}

function renderClass(node: UmlNode, rect: Rect): string {
  const kind = nodeKindOf(node)
  const stroke = inkOf(node, PALETTE.ink)
  const fill = fillOf(node, PALETTE.classFill)
  const stereotype = classifierStereotype(kind)
  const attributes = memberLines(node.data.attributes)
  const operations = memberLines(node.data.operations)
  const memberSize = Math.max(10, node.data.fontSize - 2)
  const headerHeight = stereotype ? 42 : 34
  const rest = Math.max(rect.height - headerHeight, 0)
  const attrBand = rest / 2
  const left = rect.x + 8
  const width = Math.max(rect.width - 16, 24)
  const attrTop = rect.y + headerHeight
  const opTop = attrTop + attrBand

  const box =
    `<rect x="${(rect.x + 1).toFixed(2)}" y="${(rect.y + 1).toFixed(2)}" ` +
    `width="${(rect.width - 2).toFixed(2)}" height="${(rect.height - 2).toFixed(2)}" rx="2" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="1.6"${dashOf(node)}/>`

  const divider = (y: number) =>
    `<path d="M${rect.x.toFixed(2)},${y.toFixed(2)} H${(rect.x + rect.width).toFixed(2)}" ` +
    `stroke="${stroke}" stroke-width="1.2" fill="none"/>`

  const stereo = stereotype
    ? textBlock(`«${stereotype}»`, {
        x: rectCenter(rect).x,
        y: rect.y + 8,
        maxWidth: width,
        fontSize: 10,
        fill: PALETTE.muted,
        baseline: 'top',
      })
    : ''

  const name = textBlock(node.data.label, {
    x: rectCenter(rect).x,
    y: rect.y + (stereotype ? 24 : headerHeight / 2),
    maxWidth: width,
    fontSize: node.data.fontSize,
    fill: stroke,
    bold: true,
    italic: kind === 'interface',
    baseline: stereotype ? 'top' : 'middle',
  })

  const members = (lines: readonly string[], top: number, band: number): string => {
    let cursor = top + 6
    const bottom = top + band - 4
    return lines
      .map((line) => {
        if (cursor > bottom) return ''
        const block = textBlock(line, {
          x: left,
          y: cursor,
          maxWidth: width,
          fontSize: memberSize,
          fill: stroke,
          anchor: 'start',
          baseline: 'top',
        })
        cursor += memberSize * LINE_HEIGHT
        return block
      })
      .join('')
  }

  return (
    box +
    divider(attrTop) +
    divider(opTop) +
    stereo +
    name +
    members(attributes, attrTop, attrBand) +
    members(operations, opTop, rest - attrBand)
  )
}

function renderNode(node: UmlNode): string {
  const rect = nodeRect(node)
  switch (nodeKindOf(node)) {
    case 'actor':
      return renderActor(node, rect)
    case 'useCase':
      return renderUseCase(node, rect)
    case 'boundary':
      return renderBoundary(node, rect)
    case 'class':
    case 'interface':
    case 'enumeration':
      return renderClass(node, rect)
    case 'note':
      return renderNote(node, rect)
    case 'text':
      return renderText(node, rect)
    default:
      return renderGenericShape(node, rect)
  }
}

/* -------------------------------------------------------------------------- */
/* Edge renderer                                                              */
/* -------------------------------------------------------------------------- */

function renderEdge(edge: UmlEdge, nodeById: Map<string, UmlNode>): string {
  const source = nodeById.get(edge.source)
  const target = nodeById.get(edge.target)
  if (!source || !target) return ''

  const kind = edgeKindOf(edge)
  const spec = EDGE_SPECS[kind]
  const geometry =
    edge.source === edge.target
      ? buildSelfLoopGeometry(source)
      : buildEdgeGeometry(source, target, edge.data?.waypoints ?? [])

  const markerEnd =
    spec.marker === 'none'
      ? ''
      : ` marker-end="url(#${markerId(spec.marker, 'default')})"`
  const markerStart =
    spec.startMarker === 'none'
      ? ''
      : ` marker-start="url(#${markerId(spec.startMarker, 'default')})"`
  const dash = spec.lineStyle === 'dashed' ? ' stroke-dasharray="7 5"' : ''

  const path =
    `<path d="${geometry.path}" fill="none" stroke="${PALETTE.line}" ` +
    `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"${dash}${markerStart}${markerEnd}/>`

  const label = edge.data?.label?.trim()
  if (!label) return path

  const fontSize = edge.data?.fontSize ?? 12
  const width = measureText(label, fontSize) + 8
  const { x, y } = geometry.labelPoint
  // Knock a hole in the line so the stereotype stays readable.
  const backing =
    `<rect x="${(x - width / 2).toFixed(2)}" y="${(y - fontSize * 0.78).toFixed(2)}" ` +
    `width="${width.toFixed(2)}" height="${(fontSize * 1.56).toFixed(2)}" fill="${PALETTE.background}"/>`

  const text = textBlock(label, {
    x,
    y,
    maxWidth: width,
    fontSize,
    fill: PALETTE.line,
  })

  return path + backing + text
}

/* -------------------------------------------------------------------------- */
/* Document                                                                   */
/* -------------------------------------------------------------------------- */

/** Bounding box of everything drawn, bend points included. */
function contentBounds(doc: UmlDocument): Rect {
  const rects: Rect[] = doc.nodes.map(nodeRect)

  // Actor names spill below the node box; give them room.
  for (const node of doc.nodes) {
    if (nodeKindOf(node) !== 'actor') continue
    const rect = nodeRect(node)
    rects.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height + 10 })
  }

  for (const edge of doc.edges) {
    for (const point of edge.data?.waypoints ?? []) {
      rects.push({ x: point.x, y: point.y, width: 0, height: 0 })
    }
  }

  return (
    boundsOf(rects) ?? {
      x: 0,
      y: 0,
      width: NODE_SPECS.boundary.width,
      height: NODE_SPECS.boundary.height,
    }
  )
}

export function documentToSvg(
  doc: UmlDocument,
  options: SvgExportOptions = {},
): string {
  const {
    padding = 32,
    background = PALETTE.background,
    includeCaption = true,
  } = options

  const title = doc.meta.title.trim()
  const description = doc.meta.description.trim()
  const showCaption = includeCaption && (title.length > 0 || description.length > 0)

  const content = padRect(contentBounds(doc), padding)
  const titleSize = 18
  const descriptionSize = 12.5
  const captionWidth = Math.max(content.width - padding, 240)

  const descriptionLines = description
    ? wrapText(description, captionWidth, descriptionSize)
    : []
  const captionHeight = showCaption
    ? (title ? titleSize * LINE_HEIGHT : 0) +
      descriptionLines.length * descriptionSize * LINE_HEIGHT +
      CAPTION_GAP
    : 0

  const width = content.width
  const height = content.height + captionHeight
  // Shift the drawing down so the caption band sits above it.
  const originX = -content.x
  const originY = -content.y + captionHeight

  const nodeById = new Map(doc.nodes.map((node) => [node.id, node]))
  const ordered = [...doc.nodes].sort((a, b) => a.data.z - b.data.z)
  const boundaries = ordered.filter((node) => nodeKindOf(node) === 'boundary')
  const rest = ordered.filter((node) => nodeKindOf(node) !== 'boundary')

  const caption = showCaption
    ? (title
        ? textBlock(title, {
            x: padding,
            y: padding / 2,
            maxWidth: captionWidth,
            fontSize: titleSize,
            fill: PALETTE.ink,
            anchor: 'start',
            baseline: 'top',
            bold: true,
          })
        : '') +
      (descriptionLines.length > 0
        ? textBlock(description, {
            x: padding,
            y: padding / 2 + (title ? titleSize * LINE_HEIGHT : 0),
            maxWidth: captionWidth,
            fontSize: descriptionSize,
            fill: PALETTE.muted,
            anchor: 'start',
            baseline: 'top',
          })
        : '')
    : ''

  const body =
    boundaries.map(renderNode).join('') +
    doc.edges.map((edge) => renderEdge(edge, nodeById)).join('') +
    rest.map(renderNode).join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(0)}" height="${height.toFixed(0)}" ` +
    `viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}">` +
    `<defs>${markerDefs(resolveVar, 'var(--app-bg)')}</defs>` +
    (background ? `<rect width="100%" height="100%" fill="${background}"/>` : '') +
    caption +
    `<g transform="translate(${originX.toFixed(2)},${originY.toFixed(2)})">${body}</g>` +
    `</svg>`
  )
}
