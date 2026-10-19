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

export const CLASS_GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'class-identify',
    title: 'Identificá las clases del dominio',
    guidance:
      'Cada clase es un sustantivo del negocio: una cosa que el sistema tiene que conocer y de la que guarda estado. El nombre va en singular, con mayúscula inicial, nunca un verbo.',
    example: 'Cliente, Pedido, Producto',
  },
  {
    id: 'class-members',
    title: 'Agregá atributos y operaciones',
    guidance:
      'Los atributos describen el estado (+nombre: String). Las operaciones describen el comportamiento (+confirmar(): void). Doble clic en cada compartimento para editarlo. En una enumeración, los literales van en el compartimento de atributos.',
    example: '-email: String  /  +registrar(): void',
  },
  {
    id: 'class-associate',
    title: 'Relacioná con asociaciones',
    guidance:
      'La asociación es una línea sólida entre dos clasificadores. La etiqueta puede llevar la multiplicidad o el rol (1, 0..*, "realiza"). No indica flujo: indica que las instancias se conocen.',
    example: 'Cliente —— Pedido',
  },
  {
    id: 'class-whole-part',
    title: 'Marcá todo/parte con agregación o composición',
    guidance:
      'Agregación (diamante hueco): el todo usa las partes, pero ellas pueden vivir solas. Composición (diamante relleno): las partes no existen sin el todo. Arrastrá siempre del todo hacia la parte.',
    example: 'Pedido ◆—— Línea de pedido',
  },
  {
    id: 'class-inheritance',
    title: 'Agregá herencia y realizaciones',
    guidance:
      'Generalización: el triángulo hueco se apoya en el padre, el hijo es el origen. Realización (línea punteada con triángulo): una clase implementa una interfaz. Arrastrá de la clase a la interfaz.',
    example: 'Pedido ⇢«realiza»⇢ Pagable',
  },
  {
    id: 'class-validate',
    title: 'Corregí la pestaña Validación y exportá',
    guidance:
      'Revisá la pestaña Validación hasta que no quede ningún ítem en rojo. Recién ahí exportá el diagrama en PNG o SVG para entregarlo.',
    example: '12 de 12 verificaciones en verde',
  },
]
