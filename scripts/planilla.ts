/**
 * Generates a use case diagram from a Markdown specification, without opening
 * the app.
 *
 *   bun run planilla <especificacion.md> [-o diagrama.json] [--svg [archivo.svg]]
 *                       [--per-actor <carpeta>]
 *
 * The output is an ohmydiagrams document: load it from the home screen, or
 * drop it on the canvas. The same checklist the editor shows is evaluated here
 * and printed, so a specification that cannot produce a valid diagram says so
 * at generation time rather than after the file is opened.
 *
 * With `--svg` it also writes the vector export, which is what goes into a
 * report. Text measurement falls back to an estimate without a DOM, so a label
 * may wrap a line earlier than it does on canvas; the geometry is identical.
 *
 * Everything it imports is pure: no React, no store, no DOM.
 */

import { validate } from '../src/uml/validation'
import { serializeDocument } from '../src/export/json'
import { documentToSvg } from '../src/export/svg'
import { importPlanilla, layoutPlanilla, sliceByActor } from '../src/planilla'

interface Args {
  input: string
  output: string
  svg: string | null
  /** Directory for the one-diagram-per-actor set, or null to skip it. */
  perActor: string | null
}

function parseArgs(argv: readonly string[]): Args | null {
  const positional: string[] = []
  let output = ''
  let svg: string | null = null
  let perActor: string | null = null

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string
    if (arg === '-o' || arg === '--output') {
      output = argv[index + 1] ?? ''
      index += 1
      continue
    }
    if (arg === '--svg') {
      const next = argv[index + 1]
      // `--svg` on its own derives the name from the JSON output.
      if (next && !next.startsWith('-')) {
        svg = next
        index += 1
      } else {
        svg = ''
      }
      continue
    }
    if (arg === '--per-actor') {
      perActor = argv[index + 1] ?? ''
      if (!perActor) return null
      index += 1
      continue
    }
    if (arg.startsWith('-')) return null
    positional.push(arg)
  }

  const input = positional[0]
  if (!input) return null
  const resolved = output || input.replace(/\.md$/i, '') + '.diagram.json'
  return {
    input,
    output: resolved,
    svg: svg === '' ? resolved.replace(/\.json$/i, '') + '.svg' : svg,
    perActor,
  }
}

const args = parseArgs(Bun.argv.slice(2))
if (!args) {
  console.error(
    'Uso: bun run planilla <especificacion.md> [-o diagrama.json] [--svg [archivo.svg]] [--per-actor <carpeta>]',
  )
  process.exit(1)
}

const source = Bun.file(args.input)
if (!(await source.exists())) {
  console.error(`No existe el archivo ${args.input}`)
  process.exit(1)
}

const { document, model } = importPlanilla(await source.text())

await Bun.write(args.output, serializeDocument(document))
if (args.svg) await Bun.write(args.svg, documentToSvg(document))

const actors = model.actors.length
const useCases = model.useCases.length
const includes = model.relations.filter((relation) => relation.kind === 'include').length
const extends_ = model.relations.filter((relation) => relation.kind === 'extend').length

console.log(`\n  ${args.input}  ->  ${args.output}`)
console.log(`  ${actors} actores · ${useCases} casos de uso · ${includes} «include» · ${extends_} «extend»`)
console.log(`  ${document.nodes.length} nodos y ${document.edges.length} relaciones en el lienzo\n`)

if (model.warnings.length > 0) {
  console.log('  Avisos de lectura')
  for (const warning of model.warnings) console.log(`   ~ ${warning}`)
  console.log('')
}

function checklist(doc: { nodes: typeof document.nodes; edges: typeof document.edges; meta: typeof document.meta }, indent: string): number {
  const report = validate(doc.nodes, doc.edges, doc.meta)
  console.log(`${indent}Checklist UML 2.5: ${report.passed} de ${report.total}`)
  for (const item of report.items) {
    if (item.status === 'pass') continue
    console.log(`${indent} ${item.status === 'fail' ? 'x' : '-'} ${item.number}. ${item.title}`)
    if (item.message) console.log(`${indent}    ${item.message}`)
    if (item.suggestion) console.log(`${indent}    ${item.suggestion}`)
  }
  return report.total - report.passed
}

let failures = checklist(document, '  ')
console.log('')

/* One diagram per actor. Each holds the cases that actor starts plus whatever
   they include or extend, which is what makes thirty cases readable. */
if (args.perActor) {
  console.log('  Un diagrama por actor')
  for (const { actor, model: slice } of sliceByActor(model)) {
    const sliced = layoutPlanilla(slice)
    const name = actor
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '-')
    const base = `${args.perActor}/${name}`

    await Bun.write(`${base}.json`, serializeDocument(sliced))
    if (args.svg) await Bun.write(`${base}.svg`, documentToSvg(sliced))

    const cases = slice.useCases.length
    console.log(`   ${actor} · ${cases} casos · ${base}.json`)
    failures += checklist(sliced, '     ')
  }
  console.log('')
}

// A diagram that breaks a rule is still written: it is easier to fix on the
// canvas than in the Markdown. The exit code is what a pipeline reads.
process.exit(failures === 0 ? 0 : 2)
