# Oh My Diagrams

Editor visual de diagramas de casos de uso **UML 2.5**, con una checklist de
validación que se evalúa en vivo sobre el lienzo.

La idea: dibujás libremente (como en Draw.io o Excalidraw), pero la aplicación
conoce las reglas de UML 2.5 y te va marcando en tiempo real qué le falta al
diagrama para ser correcto, así podés concentrarte en el modelado y no en
recordar la notación.

No usa Mermaid ni ninguna sintaxis de texto: el diagrama siempre se dibuja.

## Características

**Lienzo**
- Lienzo infinito con paneo, zoom, grilla de puntos y ajuste a la grilla.
- Paleta con búsqueda: Actor, Caso de uso, Límite del sistema, Nota, y formas
  genéricas (rectángulo, elipse, rombo, texto).
- Conectores flotantes que se mantienen pegados al borde de cada figura, con
  puntos de quiebre editables (doble clic sobre la línea).
- Selección múltiple, alineación y distribución, duplicar, copiar/pegar,
  z-order, menú contextual, deshacer/rehacer y atajos de teclado.

**Relaciones UML**
- Asociación, `«include»`, `«extend»`, generalización, conector de nota y flecha
  genérica.
- Las combinaciones de extremos inválidas se rechazan al dibujarlas y se explica
  la regla de UML que se estaba rompiendo.

**Validación (la parte central)**
- 17 reglas que se recalculan con cada cambio del grafo: existencia de actores y
  casos de uso, nombres en infinitivo, nombres únicos, contención dentro del
  límite, conectividad, ciclos de `«include»`, dirección de las relaciones,
  tipos en las generalizaciones, título del documento y elementos sueltos.
- Cada ítem en rojo explica qué falta y sugiere una corrección concreta; algunos
  ofrecen un arreglo de un clic (renombrar, invertir dirección).
- Segunda pestaña con la guía del proceso de modelado paso a paso.

**Persistencia y exportación**
- Autoguardado en `localStorage` con escritura diferida.
- Exportación a SVG vectorial real, PNG a 2x y JSON del documento (con carga).
- El título y la descripción del diagrama se incluyen en las exportaciones.

## Stack

Bun · Vite · React 19 · TypeScript estricto · TailwindCSS v4 ·
[@xyflow/react](https://reactflow.dev) · Zustand · lucide-react

## Desarrollo

```bash
bun install
bun dev
```

```bash
bun run typecheck   # tsc -b
bunx oxlint .       # linting
bun run build       # build de producción
```

## Arquitectura

```
src/
  types/uml.ts    Modelo de dominio: tipos de nodo y relación, y sus defaults
  store/          Zustand: documento, historial de undo/redo, autoguardado, toasts
  uml/            Lógica pura: geometría, análisis del grafo, reglas y validación
  canvas/         Componentes de React Flow: nodos, relaciones, edición en línea
  ui/             Paneles: barra superior, paleta, propiedades, checklist
  export/         Renderizador SVG, rasterizador PNG y serialización JSON
```

Tres decisiones sostienen el resto:

1. **Relaciones flotantes.** La geometría de cada línea se calcula contra la
   silueta de los nodos, no contra la posición de un handle. El lienzo y el
   exportador comparten esa matemática (`uml/geometry.ts`), así lo exportado es
   idéntico a lo dibujado.
2. **El límite del sistema es un nodo común**, no un nodo padre de React Flow.
   Usar `parentId` haría imposible violar la contención y las reglas 5 y 6 nunca
   podrían fallar; la contención se calcula geométricamente en cada evaluación.
3. **El exportador dibuja el modelo, no el DOM.** Produce SVG vectorial real
   (elipses, trazados, marcadores) en lugar de una captura envuelta en
   `foreignObject`, y el PNG se rasteriza desde ese mismo SVG.

## Licencia

MIT
