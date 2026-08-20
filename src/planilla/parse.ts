import {
  actorKey,
  type PlanillaActor,
  type PlanillaModel,
  type PlanillaRelation,
  type PlanillaUseCase,
} from './model'

/**
 * Reads a use case specification written in Markdown and returns the model it
 * states. Two shapes are understood, and a document may use either or both:
 *
 * 1. **Catalogue tables** — an actor table, a "use cases per actor" table and
 *    the «include» / «extend» tables. This is the whole diagram in four tables.
 * 2. **Planillas** — one `### CU-xx Name` block per use case, each with its own
 *    field table. A file of nothing but planillas still yields a diagram: the
 *    actor comes from the "Actor principal" field and the «include» edges from
 *    the `**include** CU-x` steps of the main flow.
 *
 * Planillas win over the catalogue on names, because that is where accents and
 * final wording live, and they can introduce use cases the catalogue omits.
 */
export function parsePlanilla(markdown: string): PlanillaModel {
  const warnings: string[] = []
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')

  const sections = splitSections(lines)
  const actors = new Map<string, PlanillaActor>()
  const useCases = new Map<string, PlanillaUseCase>()
  const relations: PlanillaRelation[] = []

  for (const section of sections) {
    const heading = normalizeHeading(section.heading)

    if (heading.includes('actores') && section.level === 2) {
      readActorTable(section.body, actors, warnings)
      continue
    }
    if (heading.includes('casos de uso por actor')) {
      readUseCasesByActor(section.body, useCases, warnings)
      continue
    }
    if (heading.includes('relaciones include')) {
      readIncludeTable(section.body, useCases, relations)
      continue
    }
    if (heading.includes('relaciones extend')) {
      readExtendTable(section.body, useCases, relations)
      continue
    }

    const planilla = matchPlanillaHeading(section.heading)
    if (planilla) readPlanilla(planilla, section.body, useCases, relations)
  }

  const model: PlanillaModel = {
    title: firstHeading(lines) ?? 'Diagrama de casos de uso',
    system: 'Sistema',
    actors: [...actors.values()],
    useCases: [...useCases.values()],
    relations: dedupeRelations(relations),
    warnings,
  }

  reconcile(model)
  return model
}

/* -------------------------------------------------------------------------- */
/* Markdown primitives                                                        */
/* -------------------------------------------------------------------------- */

interface Section {
  level: number
  heading: string
  body: string[]
}

/** Every `##`+ heading with the lines that follow it, up to the next heading. */
function splitSections(lines: readonly string[]): Section[] {
  const sections: Section[] = []
  let current: Section | null = null

  for (const line of lines) {
    const match = /^(#{2,6})\s+(.*)$/.exec(line)
    if (match) {
      if (current) sections.push(current)
      current = {
        level: (match[1] as string).length,
        heading: (match[2] as string).trim(),
        body: [],
      }
      continue
    }
    current?.body.push(line)
  }
  if (current) sections.push(current)
  return sections
}

function firstHeading(lines: readonly string[]): string | null {
  for (const line of lines) {
    const match = /^#\s+(.*)$/.exec(line)
    if (match) return (match[1] as string).trim()
  }
  return null
}

function normalizeHeading(heading: string): string {
  return actorKey(heading.replace(/^[\d.]+\s*/, ''))
}

/** Cells of a pipe table row, or `null` for anything that is not one. */
function rowCells(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim())
  // The `|---|---|` separator carries no data.
  if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return null
  return cells
}

/**
 * Data rows of the first table in `body`, header dropped. Stops at the blank
 * line after the table so a section holding two tables yields only the first.
 */
function firstTable(body: readonly string[]): string[][] {
  const rows: string[][] = []
  let started = false
  for (const line of body) {
    const cells = rowCells(line)
    if (cells) {
      rows.push(cells)
      started = true
      continue
    }
    if (started && line.trim() === '') break
  }
  return rows.slice(1)
}

/** Every table in the section, as a flat list of data rows. */
function allTableRows(body: readonly string[]): string[][] {
  const rows: string[][] = []
  let header = true
  for (const line of body) {
    const cells = rowCells(line)
    if (!cells) {
      header = true
      continue
    }
    if (header) {
      header = false
      continue
    }
    rows.push(cells)
  }
  return rows
}

const CODE = /\bCU-[A-Z0-9]+\b/g
const EMPTY_CELL = /^(?:—|-|–|ninguno|ninguna|n\/a)$/i

function codesIn(text: string): string[] {
  return [...(text.toUpperCase().match(CODE) ?? [])]
}

/** Splits "CU-01 Iniciar sesión" into its code and its name. */
function splitCoded(text: string): { code: string; name: string } | null {
  const match = /^(CU-[A-Z0-9]+)\s*[–—:-]?\s*(.*)$/i.exec(text.trim())
  if (!match) return null
  return {
    code: (match[1] as string).toUpperCase(),
    name: (match[2] as string).trim(),
  }
}

/* -------------------------------------------------------------------------- */
/* Catalogue tables                                                           */
/* -------------------------------------------------------------------------- */

function readActorTable(
  body: readonly string[],
  actors: Map<string, PlanillaActor>,
  warnings: string[],
): void {
  for (const cells of firstTable(body)) {
    const name = (cells[0] ?? '').replace(/\*/g, '').trim()
    if (!name) continue
    const key = actorKey(name)
    if (actors.has(key)) {
      warnings.push(`El actor "${name}" está declarado más de una vez.`)
      continue
    }
    const parent = (cells[1] ?? '').trim()
    actors.set(key, {
      name,
      generalizes: EMPTY_CELL.test(parent) || !parent ? null : parent,
      description: (cells[2] ?? '').trim(),
    })
  }
}

/**
 * The "use cases per actor" table. Cases are listed in one cell separated by
 * `·`, and the inherited column is ignored on purpose: inheritance is drawn by
 * the generalization edges between actors, not by duplicating associations.
 */
function readUseCasesByActor(
  body: readonly string[],
  useCases: Map<string, PlanillaUseCase>,
  warnings: string[],
): void {
  for (const cells of firstTable(body)) {
    const actor = (cells[0] ?? '').trim()
    if (!actor) continue
    for (const entry of (cells[1] ?? '').split(/[·•]/)) {
      const parsed = splitCoded(entry)
      if (!parsed || !parsed.name) continue
      const existing = useCases.get(parsed.code)
      if (existing) {
        warnings.push(
          `${parsed.code} aparece con dos actores: "${existing.actor}" y "${actor}".`,
        )
        continue
      }
      useCases.set(parsed.code, { code: parsed.code, name: parsed.name, actor })
    }
  }
}

/**
 * Registers a use case named inside a relationship table. Naming a case in the
 * «include» or «extend» table is how a document introduces a factored case that
 * no actor invokes, so those cells declare as well as reference. A cell holding
 * several codes only references, and a case already declared keeps its actor.
 */
function declare(
  useCases: Map<string, PlanillaUseCase>,
  cell: string,
): { code: string; name: string } | null {
  const parsed = splitCoded(cell)
  if (!parsed) return null
  if (parsed.name && codesIn(cell).length === 1 && !useCases.has(parsed.code)) {
    useCases.set(parsed.code, { code: parsed.code, name: parsed.name, actor: null })
  }
  return parsed
}

/** `| Caso incluido | Incluido por | Motivo |` -> base includes included. */
function readIncludeTable(
  body: readonly string[],
  useCases: Map<string, PlanillaUseCase>,
  relations: PlanillaRelation[],
): void {
  for (const cells of firstTable(body)) {
    const included = declare(useCases, cells[0] ?? '')
    if (!included) continue
    for (const base of codesIn(cells[1] ?? '')) {
      relations.push({
        kind: 'include',
        from: base,
        to: included.code,
        note: (cells[2] ?? '').trim(),
      })
    }
  }
}

/** `| Caso extensor | Extiende a | ... |` -> extension extends base. */
function readExtendTable(
  body: readonly string[],
  useCases: Map<string, PlanillaUseCase>,
  relations: PlanillaRelation[],
): void {
  for (const cells of firstTable(body)) {
    const extension = declare(useCases, cells[0] ?? '')
    const base = declare(useCases, cells[1] ?? '')
    if (!extension || !base) continue
    relations.push({
      kind: 'extend',
      from: extension.code,
      to: base.code,
      note: (cells[3] ?? cells[2] ?? '').trim(),
    })
  }
}

/* -------------------------------------------------------------------------- */
/* Planillas                                                                  */
/* -------------------------------------------------------------------------- */

function matchPlanillaHeading(heading: string): { code: string; name: string } | null {
  const parsed = splitCoded(heading)
  return parsed && parsed.name ? parsed : null
}

const ACTOR_FIELD = /actor\s+principal/i
const INCLUDE_STEP = /\*\*include\*\*\s*(CU-[A-Z0-9]+)/gi

/**
 * One planilla. Contributes the final name, the principal actor and any
 * «include» named in the main flow, which is what makes a file of planillas
 * alone enough to draw a diagram.
 */
function readPlanilla(
  planilla: { code: string; name: string },
  body: readonly string[],
  useCases: Map<string, PlanillaUseCase>,
  relations: PlanillaRelation[],
): void {
  let actor: string | null = null
  for (const cells of allTableRows(body)) {
    const field = (cells[0] ?? '').replace(/\*/g, '').trim()
    if (!ACTOR_FIELD.test(field)) continue
    actor = principalActor(cells[1] ?? '')
    break
  }

  const existing = useCases.get(planilla.code)
  useCases.set(planilla.code, {
    code: planilla.code,
    // The planilla heading is the authoritative wording.
    name: planilla.name,
    actor: actor ?? existing?.actor ?? null,
  })

  const text = body.join('\n')
  for (const match of text.matchAll(INCLUDE_STEP)) {
    relations.push({
      kind: 'include',
      from: planilla.code,
      to: (match[1] as string).toUpperCase(),
      note: `Paso del flujo principal de ${planilla.code}.`,
    })
  }
}

/**
 * "Solicitante (y por generalización, todos los actores humanos)" names one
 * actor; the parenthesis restates the hierarchy that the generalization edges
 * already draw.
 */
function principalActor(cell: string): string | null {
  const name = cell
    .replace(/\(.*?\)/g, '')
    .replace(/\*/g, '')
    .split(/[,;]/)[0]
    ?.trim()
  return name ? name : null
}

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                             */
/* -------------------------------------------------------------------------- */

function dedupeRelations(relations: readonly PlanillaRelation[]): PlanillaRelation[] {
  const seen = new Map<string, PlanillaRelation>()
  for (const relation of relations) {
    const key = `${relation.kind}:${relation.from}->${relation.to}`
    // First writer wins: the catalogue table's justification beats the flow
    // step's generic one, and the tables are read before the planillas.
    if (!seen.has(key)) seen.set(key, relation)
  }
  return [...seen.values()]
}

/**
 * Drops relationships whose endpoints no table declares, and registers an actor
 * that only a planilla mentions. Both are reported: an edge pointing nowhere is
 * a typo in the document, not something to draw around.
 */
function reconcile(model: PlanillaModel): void {
  const codes = new Set(model.useCases.map((useCase) => useCase.code))
  const kept: PlanillaRelation[] = []

  for (const relation of model.relations) {
    const missing = [relation.from, relation.to].filter((code) => !codes.has(code))
    if (missing.length > 0) {
      model.warnings.push(
        `La relación «${relation.kind}» ${relation.from} -> ${relation.to} referencia ${missing.join(' y ')}, que ningún cuadro declara.`,
      )
      continue
    }
    if (relation.from === relation.to) {
      model.warnings.push(`${relation.from} se relaciona consigo mismo; se omite.`)
      continue
    }
    kept.push(relation)
  }
  model.relations = kept

  const known = new Set(model.actors.map((actor) => actorKey(actor.name)))
  for (const useCase of model.useCases) {
    if (!useCase.actor) continue
    const key = actorKey(useCase.actor)
    if (known.has(key)) continue
    known.add(key)
    model.actors.push({ name: useCase.actor, generalizes: null, description: '' })
    model.warnings.push(
      `El actor "${useCase.actor}" sale de una planilla y no del cuadro de actores.`,
    )
  }
}
