# Estado del proyecto y cómo continuar

Última actualización: 2026-08-19. Documento de traspaso para retomar el trabajo
en otra máquina.

## Cómo arrancar en un equipo nuevo

```bash
git clone https://github.com/ohmyapps-org/ohmydiagrams.git
cd ohmydiagrams
bun install
bun dev
```

Verificación:

```bash
bun run typecheck && bunx oxlint . && bun test && bun run build
```

Los cuatro pasan limpio. No hay backend ni cuentas: los documentos viven en
`localStorage` del navegador. El único proceso extra es el servidor MCP
(`bun run mcp`), que tampoco guarda estado.

## Lo último que se hizo (sesión 2026-08-19)

**Arreglos**

- **Con el lienzo en blanco no se valida nada.** `validate()` devuelve
  `blank: true` y las 17 reglas en estado `idle` (gris, sin mensaje) cuando no
  hay ni un nodo ni una relación. Antes un documento vacío mostraba 12 errores.
- **El título se edita en un solo lugar**, la barra superior. El panel derecho
  ahora lo muestra de sólo lectura y sigue editando la descripción.
- **Un solo menú "Conexiones"** en lugar de dos botones con enchufes parecidos:
  una fila para el modelo de IA (BYOK por URL) y otra para el agente MCP, cada
  una con su estado y su explicación (`ui/ConnectionsMenu.tsx`).

**Nuevo**

- **Biblioteca de documentos** (`store/library.ts`): varios diagramas, cada uno
  en su archivo de `localStorage`, con un índice aparte para la pantalla de
  inicio. Migra sola el documento único de las versiones anteriores.
- **Vista de inicio** (`ui/Home.tsx`): tus diagramas (abrir, duplicar, borrar,
  cargar JSON), las tarjetas para empezar uno nuevo y tus especificaciones de
  requisitos guardadas.
- **Tipos de diagrama** (`diagrams/registry.ts`): casos de uso, flujo, QA y
  automatización. Los tres últimos dibujan con formas genéricas y todavía no
  tienen reglas ni guía; la interfaz se adapta sola porque lee del registro.
- **Modo zen** (tecla `Z` o el botón de la barra): sólo el lienzo.

## Qué está hecho

Todo el alcance P0, más cinco funciones nuevas:

- Lienzo infinito, paleta, seis tipos de nodo y seis de relación, edición en
  línea, alineación, z-order, deshacer/rehacer y atajos.
- Motor de validación con las 17 reglas y guía de proceso de 6 pasos.
- Autoguardado, exportación a SVG / PNG 2x / JSON y carga desde JSON.
- **Menú rápido**: clic derecho sobre el lienzo vacío abre un menú en el cursor
  con el esqueleto de un diagrama completo y las formas más usadas.
- **Doble clic**: crea una etiqueta de texto centrada en el cursor y abre el
  editor.
- **Servidor MCP** (`mcp/`) que expone el lienzo abierto a un agente.
- **Pestaña Requisitos**: importa PDF / Markdown / TXT y propone los casos de
  uso que el documento pide, contrastados contra el lienzo.
- **Tema claro y oscuro** con interruptor en la barra superior; sin elección
  guardada sigue al sistema operativo.

## Qué está verificado y qué no

Esta distinción es lo más importante de este documento.

**Verificado en el navegador (sesiones anteriores):**

- Lienzo, paleta, arrastre, edición de nodos, redimensionado, propiedades.
- Checklist en vivo, incluido llegar a 17/17 "Diagrama válido".
- El ciclo de conexión completo y la exportación SVG con geometría vectorial
  real.

**Verificado en el navegador (2026-08-18):**

- **Toasts.** Era lo único sin evidencia y ya la tiene: el aviso se renderiza
  centrado abajo (214x40, `z-index` 60, opacidad 1), se autodescarta a los
  3,2 s y el botón de cerrar lo saca.
- Deshacer y rehacer con teclas reales (⌘Z / ⇧⌘Z), copiar/pegar (⌘C/⌘V),
  duplicar (⌘D), borrar, seleccionar todo (⌘A), Escape, G (ajuste a grilla),
  F (encuadre) y ⌘+ (zoom).
- Menú rápido: abre en el punto exacto del clic derecho; el clic izquierdo no
  abre nada y el arrastre con el botón derecho (paneo) tampoco. El esqueleto
  inserta 5 nodos y 3 asociaciones como un solo paso de historial.
- Tema oscuro: al arrancar sigue al sistema (`data-theme="dark"`, fondo
  `#0f1115`, `--uml-ink` `#e8eaed`, React Flow en `colorMode` oscuro); el
  interruptor lo cambia, lo guarda y los nodos del lienzo se repintan con la
  paleta oscura.
- Doble clic: crea el nodo de texto centrado en el cursor, con el editor
  enfocado; se escribió y se confirmó con Enter.
- MCP de punta a punta con un cliente MCP real: `clear`, `set_meta`,
  `insert_skeleton`, `get_diagram`, `add_node`, `add_edge` válido, `add_edge`
  inválido (devuelve la explicación de la regla), `update_node` y
  `get_validation` (16/17, con la regla 5 marcando el caso de uso que quedó
  fuera del límite).
- Pestaña Requisitos: importó un Markdown, propuso 4 casos de uso con sus
  actores, y "Agregar" creó el nodo y movió el contador a 1 de 4.
- Paleta: clic crea la forma en el centro de lo visible y los clics repetidos
  cascadean de a 20 px sin apilarse.

**Verificado en el navegador (2026-08-19):**

- Checklist en blanco: las 17 reglas en gris sin un solo error, el contador
  desaparece, y vuelve a 12/17 apenas se agrega el primer actor. Deshacer lo
  deja otra vez en gris.
- Menú "Conexiones": las dos filas con su estado, el agente MCP pasando a
  "Buscando…" y volviendo a "Sin conectar", el punto verde en el botón, y el
  diálogo del modelo abriéndose desde la fila de arriba.
- Migración del documento único: se sembró la clave vieja
  `ohmydiagrams:document:v1`, y al recargar quedó una entrada en la biblioteca
  con su archivo propio, abierta, con el `ui` (incluido `guideChecks`) intacto.
- Inicio: tarjetas de los cuatro tipos, lista de diagramas con tipo, tamaño y
  "editado recién", duplicar y borrar (el archivo del duplicado borrado
  desaparece de `localStorage`).
- Un diagrama de flujo creado desde el inicio: insignia FLUJO, paleta genérica,
  conector por defecto "Flecha", sólo la pestaña Validación y el mensaje de
  "todavía no tiene reglas propias".
- Autoguardado con varios documentos: el título y el contador de elementos del
  diagrama abierto llegan al índice, y abrir el otro documento no arrastra ni
  nodos ni historial (deshacer queda deshabilitado).
- Modo zen con la tecla `Z`: se van barra, paleta y panel; el botón "Salir del
  zen" y la preferencia guardada en `localStorage`.
- Requisitos guardados: la lista "Guardados" en la pestaña y el botón que vuelve
  a leer el texto de una especificación ya importada (2 casos de uso propuestos).

**NO verificado todavía:**

- La descarga real del PNG y la carga de un JSON desde el disco (implican el
  diálogo del sistema operativo).
- `delete_elements` del servidor MCP (las otras nueve herramientas sí se
  ejercitaron).
- Lectura de un PDF real. El camino de Markdown y texto sí se ejercitó; el de
  PDF sólo compila y quedó separado en su propio chunk.
- La importación de una especificación **desde el disco** (el diálogo del
  sistema operativo). Lo que sí se ejercitó es el otro extremo: una
  especificación ya guardada en la biblioteca se vuelve a leer y propone sus
  casos de uso.
- Las reglas 6, 9, 10, 11, 12, 13, 14, 15 y 17 no se vieron pasar de verde a
  rojo en vivo. La lógica es pura y está en `uml/validation.ts`.

## Trampa del entorno de prueba (leer antes de depurar)

Si el panel de vista previa del navegador no está visible, la página no compone:
el `ResizeObserver` de React Flow nunca dispara, los nodos quedan con
`measured: {}` y `handleBounds: null`, y **las relaciones no se dibujan aunque
estén bien creadas en el store**. Se confirmó inspeccionando el store interno de
React Flow por fibra. No es un bug de la aplicación: los nodos se ven porque su
tamaño viene de estilos en línea, pero las líneas necesitan la medición.

Dos consecuencias prácticas:

- Para ver relaciones o sacar capturas hay que mostrar el panel.
- Los eventos sintéticos no alcanzan para simular un clic en el lienzo. Con
  `selectionOnDrag`, React Flow no engancha `onClick` en el pane: el clic sale
  de `onPointerUp`, que exige un `pointerdown` previo que haya pasado por
  `setPointerCapture`. Un `PointerEvent` despachado a mano hace que
  `setPointerCapture` tire `NotFoundError` y el clic se pierde. Se lo puede
  neutralizar desde la consola con un `Element.prototype.setPointerCapture`
  vacío mientras dura la prueba.
- `await import('/src/store/document.ts')` desde la consola **puede** devolver
  una segunda instancia del módulo (Vite sirve URLs con `?t=` después de cada
  HMR), y entonces se está leyendo un store paralelo con los mismos datos
  rehidratados. Si `past.length` da 0 mientras la app tiene historial, es eso.
  El DOM es la fuente de verdad para verificar.

## Decisiones de arquitectura que conviene no revisar de cero

1. **Relaciones flotantes.** La geometría se calcula contra la silueta de los
   nodos (`uml/geometry.ts`), no contra un handle. El lienzo y el exportador
   comparten esa matemática; si se toca, hay que revisar las dos salidas.

2. **El límite del sistema es un nodo común**, no un nodo padre de React Flow.
   Con `parentId` y `extent: 'parent'` sería imposible violar la contención y
   las reglas 5 y 6 nunca podrían fallar.

3. **Las reglas 11, 13 y 14 combinan chequeos estructurales con heurísticas.**
   La dirección queda fijada al crear la relación, así que se valida lo que sí
   es falsable y se detecta la inversión probable por la señal semántica.

4. **El exportador dibuja el modelo, no el DOM.**

5. **En el puente MCP manda el navegador.** El servidor (`mcp/server.ts`)
   levanta un WebSocket en loopback y no guarda estado; el documento sólo vive
   en el navegador, que se conecta como cliente. Cada herramienta es una ida y
   vuelta (`src/bridge/protocol.ts` define el contrato para los dos lados) y
   cada mutación pasa por las mismas acciones del store que usa la interfaz, así
   que los cambios del agente entran al mismo historial y al mismo
   autoguardado. El botón del enchufe es opt-in a propósito: nada se conecta
   solo, y así tampoco se llena la consola de reintentos.

6. **El tipo de diagrama vive en un registro** (`diagrams/registry.ts`), no en
   condicionales repartidos. Cada tipo declara paleta, reglas, guía, conector
   por defecto y si el lector de requisitos le sirve; la paleta, la checklist,
   el lienzo y el puente MCP leen de ahí. Los tipos "flujo", "QA" y
   "automatización" existen como entradas con formas genéricas y `validate` que
   no devuelve reglas: la interfaz ya sabe mostrar "todavía no tiene reglas
   propias" sin ramas nuevas.

7. **La biblioteca es la dueña de la persistencia.** El store del documento
   (`store/document.ts`) perdió el middleware `persist` y sólo conoce el
   diagrama abierto; `store/library.ts` se suscribe a sus cambios y escribe en
   el archivo del `activeId`. Dos consecuencias que conviene no romper: al
   abrir un documento el `activeId` se fija **antes** de `loadDocument` (si no,
   el autoguardado escribe el diagrama nuevo en el archivo del anterior), y
   `loadDocument` limpia el historial, porque el undo no debe cruzar de un
   diagrama a otro.

8. **La extracción de requisitos está detrás de una interfaz**
   (`requirements/types.ts`). La implementación que se envía es local y
   determinista; `setRequirementExtractor` permite cambiarla por una con modelo
   sin tocar la interfaz. La versión local **no traduce ni inventa**: si la
   frase no da un "infinitivo + objeto" la deja como está y marca
   `compliant: false`, porque la regla 3 de la checklist ya sabe señalarla y
   arreglarla.

## Trampas ya encontradas (no volver a pisarlas)

- **`isValidConnection` impide que `onConnect` se ejecute.** La explicación de
  la regla vive en `onConnectEnd`, que sí dispara para los intentos rechazados.

- **El stack de fuentes rompía el XML del SVG.** Hay dos constantes en
  `export/text.ts`: `MEASURE_FONT_STACK` y `SVG_FONT_STACK`.

- **`.glass` usa `backdrop-filter`, que crea un bloque contenedor.** Los menús
  flotantes se renderizan con `createPortal` a `document.body`, hoy centralizado
  en `canvas/MenuShell.tsx`, que además los repliega para que no se salgan de la
  ventana.

- **Selectores de Zustand que construyen arrays nuevos necesitan `useShallow`.**

- **`connectionRadius` está en 70.**

- **Un identificador que empieza con `use` parece un hook.** `oxlint` rechazó
  `useCaseSkeleton()` por `rules-of-hooks`; por eso la función del esqueleto se
  llama `createUseCaseSkeleton`.

- **Al ubicar formas hay que comparar contra coordenadas ya ajustadas a la
  grilla.** `createNode` ajusta la posición al guardarla, así que un candidato
  sin ajustar nunca coincide con lo que está en el store y la cascada de
  `avoidOverlap` no se dispara. Costó dos intentos.

## Pendiente

**Siguiente en la lista (backlog del 2026-08-19)**

- **Compartir por link**, **guardado en la nube con cuenta de GitHub/Google** y
  **colaboración en vivo hasta 4 personas**. Los tres necesitan backend y una
  decisión de hosting. El paso previo ya está hecho: cada documento tiene id
  propio y la biblioteca es el único lugar que escribe. Lo que falta del lado
  del cliente es que `store/library.ts` pueda tener otro respaldo además de
  `localStorage`.
- **Onboarding** (explícitamente fuera del alcance de esta tanda).
- Notación propia para flujo, QA y automatización: hoy son entradas del registro
  con formas genéricas. Cada una necesita sus tipos de nodo, sus reglas y su
  guía; el resto de la aplicación no se toca.

**P1 sin empezar**

- Modo foco: al hacer clic en un ítem rojo, mover la cámara hacia los elementos
  involucrados (los ids ya viajan en `elementIds`).
- Exportación a PlantUML (nunca Mermaid).

**Ideas sueltas**

- Tests: hay 20, sobre `requirements/`, `llm/client.ts`, `uml/validation.ts`
  (lienzo en blanco) y `export/json.ts` (el tipo de diagrama en el ida y
  vuelta). Los siguientes candidatos son el resto de `uml/validation.ts`,
  `export/svg.ts` y `uml/placement.ts`, que ya tuvo un bug real de coordenadas
  sin ajustar. `store/library.ts` necesita `localStorage`, así que hoy sólo se
  verifica en el navegador.
- El bundle principal quedó en 545 kB (175 kB con gzip). React Flow sigue siendo
  la mayor parte; pdf.js ya está en su propio chunk perezoso de 427 kB.
- El menú rápido no usa `onPaneContextMenu`: React Flow ignora ese callback
  cuando `panOnDrag` incluye el botón derecho, así que el evento se escucha en
  el contenedor y se descarta si el puntero viajó más de `PAN_SLOP_PX` entre
  el `pointerdown` y el `contextmenu`, que es como se distingue un clic de un
  paneo.
- La exportación **no** sigue el tema: `export/svg.ts` mapea las variables CSS a
  una paleta clara fija, así que un SVG o un PNG exportados en modo oscuro
  siguen saliendo claros. Es deliberado (un diagrama se pega en un documento
  claro), pero si alguna vez se quiere exportar en oscuro, el punto único a
  tocar es `PALETTE`.
- Cuando el límite del sistema se llena, `nextUseCaseSlot` manda el caso de uso
  nuevo al costado en vez de agrandar el límite. Es deliberado (no tocar el
  dibujo del usuario), pero deja el elemento fuera y la regla 5 lo marca.
