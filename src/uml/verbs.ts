/** Removes diacritics so "Consultar" and "consúltar" compare equal. */
export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeName(value: string): string {
  return stripAccents(value).trim().toLowerCase().replace(/\s+/g, ' ')
}

const INFINITIVE = /^[a-zñ]+(ar|er|ir)(se)?$/

/**
 * UML 2.5 names a use case with a complete action: an infinitive verb plus its
 * object ("Registrar venta"). Spanish infinitives always end in -ar/-er/-ir,
 * optionally with an enclitic reflexive pronoun, which makes this checkable.
 */
export function isInfinitivePhrase(name: string): boolean {
  const tokens = normalizeName(name).split(' ').filter(Boolean)
  const verb = tokens[0]
  if (!verb || verb.length < 4) return false
  if (!INFINITIVE.test(verb)) return false
  // "Registrar" alone is a verb without an object; UML wants both.
  return tokens.length >= 2
}

/** Nouns that map to a specific, idiomatic verb rather than the fallback. */
const VERB_FOR_NOUN: Record<string, string> = {
  venta: 'Registrar',
  ventas: 'Registrar',
  compra: 'Registrar',
  pedido: 'Registrar',
  cliente: 'Registrar',
  clientes: 'Gestionar',
  usuario: 'Registrar',
  producto: 'Registrar',
  productos: 'Gestionar',
  pago: 'Realizar',
  pagos: 'Realizar',
  saldo: 'Consultar',
  stock: 'Consultar',
  precio: 'Consultar',
  reporte: 'Generar',
  reportes: 'Generar',
  informe: 'Generar',
  factura: 'Emitir',
  facturacion: 'Emitir',
  sesion: 'Iniciar',
  login: 'Iniciar',
  ingreso: 'Registrar',
  busqueda: 'Realizar',
  consulta: 'Realizar',
  reserva: 'Realizar',
  alta: 'Dar de',
  baja: 'Dar de',
  envio: 'Realizar',
  entrega: 'Registrar',
  devolucion: 'Procesar',
  inventario: 'Consultar',
  turno: 'Agendar',
  cita: 'Agendar',
}

/**
 * Suggests a compliant rename for a noun-shaped use case name.
 * "Venta" -> "Registrar venta"; unknown nouns fall back to "Gestionar X".
 */
export function suggestInfinitivePhrase(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'Registrar venta'

  const tokens = trimmed.split(/\s+/)
  const head = normalizeName(tokens[0] ?? '')

  // Already a verb, just missing its object.
  if (INFINITIVE.test(head) && head.length >= 4 && tokens.length === 1) {
    return `${trimmed} <objeto>`
  }

  const verb = VERB_FOR_NOUN[head] ?? 'Gestionar'
  const object = tokens.join(' ')
  return `${verb} ${object.charAt(0).toLowerCase()}${object.slice(1)}`
}
