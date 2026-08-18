/** Tab B: the modelling process, in the order the spec prescribes. */
export interface GuideStep {
  id: string
  title: string
  guidance: string
  example: string
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'step-boundary',
    title: 'Definí el sistema y dibujá su límite',
    guidance:
      'El límite marca qué queda adentro (lo que vas a construir) y qué queda afuera. Nombralo con el nombre del sistema, no con el de la empresa.',
    example: 'Sistema de Punto de Venta',
  },
  {
    id: 'step-actors',
    title: 'Identificá los actores y ubicalos FUERA',
    guidance:
      'Un actor es todo lo externo que interactúa con el sistema: personas, otros sistemas o dispositivos. Se nombra con un sustantivo y un rol, nunca con el nombre de una persona.',
    example: 'Cliente, Cajero, Pasarela de pago',
  },
  {
    id: 'step-use-cases',
    title: 'Identificá los casos de uso y ubicalos ADENTRO',
    guidance:
      'Cada caso de uso es una función completa que deja un resultado observable para el actor. Nombralo con verbo en infinitivo + objeto. Un paso suelto no es un caso de uso.',
    example: 'Registrar venta (no "Venta", no "Ingresar código")',
  },
  {
    id: 'step-associations',
    title: 'Asociá cada actor con los casos en los que participa',
    guidance:
      'La asociación es una línea sólida sin punta de flecha, y sólo une un actor con un caso de uso. Indica participación, no flujo de datos.',
    example: 'Cajero —— Registrar venta',
  },
  {
    id: 'step-relations',
    title: 'Agregá «include», «extend» y generalización',
    guidance:
      '«include» para comportamiento obligatorio compartido, «extend» para comportamiento opcional o condicional, generalización para jerarquías de actores o de casos de uso.',
    example: 'Registrar venta ⇢«include»⇢ Validar stock',
  },
  {
    id: 'step-validate',
    title: 'Corregí la pestaña Validación y exportá',
    guidance:
      'Revisá la pestaña Validación hasta que no quede ningún ítem en rojo. Recién ahí exportá el diagrama en PNG o SVG para entregarlo.',
    example: '17 de 17 verificaciones en verde',
  },
]
