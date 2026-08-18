# Estado del proyecto y cómo continuar

Última actualización: 2026-08-18. Documento de traspaso para retomar el trabajo
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
bun run typecheck && bunx oxlint . && bun run build
```

Los tres pasan limpio en `main`. No hay backend, ni variables de entorno, ni
cuentas: todo el estado vive en `localStorage` del navegador.

## Qué está hecho

Todo el alcance P0 de la especificación está implementado:

- Lienzo infinito con paneo, zoom, grilla y ajuste a grilla.
- Paleta con búsqueda, arrastre y clic para crear formas.
- Seis tipos de nodo (actor, caso de uso, límite, nota, formas genéricas, texto)
  y seis tipos de relación.
- Edición en línea, redimensionado, selección múltiple, alineación y
  distribución, menú contextual, z-order, deshacer/rehacer y atajos.
- Motor de validación con las 17 reglas, más la guía de proceso de 6 pasos.
- Autoguardado en `localStorage`, exportación a SVG / PNG 2x / JSON y carga
  desde JSON.

## Qué está verificado y qué no

Esta distinción es lo más importante de este documento.

**Verificado en el navegador:**

- Lienzo, paleta, arrastre, edición de nodos, redimensionado, panel de
  propiedades.
- La checklist actualizándose en vivo. Se comprobó la regla 3 pasando a rojo con
  el nombre `Venta`, mostrando la sugerencia `Registrar venta`, y el arreglo de
  un clic dejándola en verde.
- Un diagrama completo llegando a **17/17 "Diagrama válido"**.
- El ciclo de conexión de punta a punta: `onConnectStart`, `isValidConnection` y
  `onConnectEnd` disparando con los veredictos correctos.
- Exportación SVG: se renderizó la salida y se confirmó geometría vectorial
  real, el triángulo hueco de generalización apoyado en el padre, `«include»`
  punteado con punta de flecha abierta, la banda de encabezado del límite y el
  epígrafe con el título.

**NO verificado todavía. Revisar antes de confiar en esto:**

- **El sistema de toasts nunca se vio renderizar en pantalla.** Los logs prueban
  que `onConnectEnd` dispara con `isValid: false` y ambos extremos resueltos,
  que es la rama que llama a `toast.error`, pero nunca se capturó visualmente el
  aviso. El componente `ui/Toasts.tsx` está sin comprobar.
- Deshacer/rehacer en la aplicación corriendo (la lógica del store está escrita,
  pero no se ejercitó desde la UI).
- Copiar/pegar y duplicar.
- La descarga real del PNG y la carga de un JSON.
- Los atajos de teclado de `hooks/useShortcuts.ts`.
- Las reglas 6, 9, 10, 11, 12, 13, 14, 15 y 17 no se vieron cambiar de verde a
  rojo en vivo. La lógica es pura y está en `uml/validation.ts`, pero conviene
  confirmarlas contra el lienzo.

Sugerencia para la próxima sesión: empezar por los toasts, porque es el único
componente del que no hay ninguna evidencia de que funcione.

## Decisiones de arquitectura que conviene no revisar de cero

1. **Relaciones flotantes.** La geometría se calcula contra la silueta de los
   nodos (`uml/geometry.ts`, `intersectBorder` y `buildEdgeGeometry`), no contra
   la posición de un handle. El lienzo y el exportador comparten esa matemática,
   y por eso lo exportado coincide con lo dibujado. Si se toca la geometría, hay
   que revisar las dos salidas.

2. **El límite del sistema es un nodo común, no un nodo padre de React Flow.**
   Usar `parentId` con `extent: 'parent'` haría imposible violar la contención,
   y entonces las reglas 5 y 6 nunca podrían fallar. La contención se calcula
   geométricamente en cada evaluación.

3. **Las reglas 11, 13 y 14 combinan chequeos estructurales con heurísticas.**
   La dirección queda fijada al crear la relación (`include` siempre va
   `source` = base hacia `target` = incluido), así que no puede fallar de forma
   estructural. Se valida lo que sí es falsable (extremos, autolazos, ciclos) y
   además se detecta la inversión probable por la señal semántica: el caso base
   es el que habla con un actor, el incluido o el extensor son fragmentos
   internos. Cada relación marcada ofrece "Invertir dirección". Las heurísticas
   exactas están documentadas en `uml/validation.ts`.

4. **El exportador dibuja el modelo, no el DOM.** Produce SVG vectorial real y
   el PNG se rasteriza desde ese mismo SVG. El costo es que es un segundo camino
   de renderizado que hay que mantener sincronizado con los componentes del
   lienzo.

## Trampas ya encontradas (no volver a pisarlas)

- **`isValidConnection` impide que `onConnect` se ejecute.** Si la conexión es
  inválida, React Flow la descarta antes de llamar a `onConnect`, así que la
  explicación de la regla no puede vivir ahí. Está en `onConnectEnd`, que sí
  dispara para los intentos rechazados.

- **El stack de fuentes rompía el XML del SVG.** Los nombres de familia van
  entre comillas dobles en CSS, y eso invalida un atributo `font-family` en XML.
  Por eso hay dos constantes en `export/text.ts`: `MEASURE_FONT_STACK` para
  medir y `SVG_FONT_STACK` con comillas simples para exportar. Toda exportación
  salía corrupta antes de separarlas.

- **`.glass` usa `backdrop-filter`, que crea un bloque contenedor.** Los hijos
  con `position: fixed` quedan recortados por el panel. Por eso `ContextMenu` se
  renderiza con `createPortal` a `document.body` y la barra superior lleva
  `relative z-30`.

- **Selectores de Zustand que construyen arrays nuevos necesitan `useShallow`.**
  Sin eso se entra en un bucle infinito de renders. Ver `ui/PropertiesPanel.tsx`.

- **`connectionRadius` está en 70.** Con el valor por defecto (20) había que
  soltar la conexión justo encima de un handle de 9px.

- Al depurar con herramientas de navegador: si el panel de vista previa no está
  visible, la página no compone y todas las medidas dan 0x0, lo que hace que
  React Flow avise que el contenedor no tiene tamaño. Es un artefacto del
  entorno de prueba, no un error de la aplicación.

## Pendiente: alcance P1

Nada de esto está empezado.

- Alternador de tema claro/oscuro. La paleta oscura ya está definida en
  `index.css` bajo `[data-theme="dark"]` y existe la variante `dark` de
  Tailwind, así que falta solamente el control que escriba el atributo.
- Modo foco: al hacer clic en un ítem rojo, mover la cámara hacia los elementos
  involucrados. Hoy sólo se seleccionan y se resaltan; los ids ya viajan en
  `elementIds` de cada `ValidationItem`.
- Exportación a PlantUML (nunca Mermaid).

## Ideas sueltas

- No hay tests. Los dos módulos que más los merecen son `uml/validation.ts` y
  `export/svg.ts`, porque son puros y porque el exportador ya tuvo un error real
  que un test habría atrapado. `export/text.ts` degrada correctamente sin DOM,
  así que se pueden ejecutar con `bun test` sin navegador.
- El bundle está en unos 485 kB (155 kB con gzip). Si molesta, React Flow es la
  mayor parte.
