# Oh My Diagrams

Editor visual de diagramas de casos de uso **UML 2.5**, con una checklist de
validación que se evalúa en vivo sobre el lienzo.

La idea: dibujás libremente (como en Draw.io o Excalidraw), pero la aplicación
conoce las reglas de UML 2.5 y te va marcando en tiempo real qué le falta al
diagrama para ser correcto, así podés concentrarte en el modelado y no en
recordar la notación.

No usa Mermaid ni ninguna sintaxis de texto: el diagrama siempre se dibuja.

## Características

**Inicio y biblioteca**
- Pantalla de inicio con tus diagramas guardados, cada uno con su tipo, su
  tamaño y cuándo lo tocaste por última vez. Abrir, duplicar, borrar o cargar
  un JSON, y arriba las tarjetas para empezar uno nuevo.
- Tus especificaciones de requisitos también quedan guardadas ahí: se importan
  una vez y se leen desde cualquier diagrama.
- Cuatro tipos de diagrama registrados: **casos de uso** (con las 17 reglas y la
  guía), y **flujo**, **QA** y **automatización**, que por ahora dibujan con las
  formas genéricas y no tienen reglas propias. El tipo decide la paleta, la
  checklist y la guía; el resto del editor no sabe de tipos
  (`src/diagrams/registry.ts`).

**Lienzo**
- Lienzo infinito con paneo, zoom, grilla de puntos y ajuste a la grilla.
- Paleta con búsqueda: Actor, Caso de uso, Límite del sistema, Nota, y formas
  genéricas (rectángulo, elipse, rombo, texto).
- Conectores flotantes que se mantienen pegados al borde de cada figura, con
  puntos de quiebre editables (doble clic sobre la línea).
- Selección múltiple, alineación y distribución, duplicar, copiar/pegar,
  z-order, menú contextual, deshacer/rehacer y atajos de teclado.
- Clic derecho sobre el lienzo vacío: menú rápido con el esqueleto de un
  diagrama completo y las formas más usadas. Doble clic: etiqueta de texto lista
  para escribir.
- Tema claro y oscuro, con un interruptor en la barra superior. Sin elección
  guardada sigue al sistema operativo.
- Modo zen (tecla `Z`): se van la barra, la paleta y el panel derecho, y queda
  el lienzo solo.

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
- Con el lienzo en blanco no se valida nada: las 17 reglas se muestran en gris,
  esperando. Un diagrama vacío no rompe ninguna regla.
- Segunda pestaña con la guía del proceso de modelado paso a paso.

**Requisitos**
- Importación de la especificación de requisitos en PDF, Markdown o texto plano,
  leída dentro del navegador (pdf.js se carga sólo si abrís un PDF).
- La lectura propone casos de uso a partir de las frases que enuncian una
  capacidad ("el sistema debe permitir registrar ventas") y los contrasta contra
  el lienzo: qué ya está dibujado y qué falta, con un botón para agregarlo.
- La extracción está detrás de una interfaz (`requirements/types.ts`): sin modelo
  configurado corre la implementación local y determinista, y con uno conectado
  corre el modelo, sin cambiar nada de la interfaz de usuario.

**Especificacion en Markdown (planillas)**
- Importador estructurado para documentos que **ya declaran el modelo** en vez
  de enunciarlo en prosa: un cuadro de actores con su generalizacion, un cuadro
  de casos de uso por actor, y los cuadros de «include» y «extend». Con esos
  cuatro cuadros sale el diagrama entero, ubicado y validado, no una lista de
  candidatos.
- Tambien lee **planillas sueltas**: un bloque `### CU-01 Nombre` por caso, con
  su campo "Actor principal" y los pasos `**include** CU-x` del flujo principal.
  Un archivo que solo tiene planillas alcanza para dibujar.
- Es la contraparte del lector de requisitos: aquel adivina capacidades a partir
  de frases y por eso marca cada propuesta como tal; este no infiere nada,
  porque cada dato lo escribio una persona a proposito.
- La ubicacion es determinista: el mismo Markdown produce el mismo archivo, asi
  regenerar despues de editar el documento da un diff revisable y no un lienzo
  barajado. Los casos de uso entran dentro del limite, los actores quedan
  afuera, y la cadena de generalizacion se lee de arriba hacia abajo.
- **Un diagrama por actor** ademas del completo. Cada rebanada lleva los casos
  que ese actor inicia, mas los que estos incluyen o extienden, y solo los
  actores que inician alguno de los casos dibujados. Un ancestro cuyos casos no
  se muestran queda fuera a proposito: dibujarlo dejaria un actor sin ninguna
  asociacion frente a un hijo con varias, que es justo la forma que la regla 14
  lee como generalizacion invertida. La herencia pasa al pie del diagrama.
- Desde la linea de comandos, sin abrir la app:

  ```bash
  bun run planilla especificacion.md -o diagrama.json --svg --per-actor diagramas/
  ```

  Imprime lo que leyo, los avisos de lectura y la misma checklist de 17 reglas
  que muestra el editor. Sale con codigo 2 si alguna regla falla, para poder
  encadenarlo.

**Agentes (MCP)**
- Servidor MCP que expone el lienzo abierto a un agente: leer el diagrama,
  crear y conectar elementos, renombrar, borrar y consultar la checklist.
- **Conector remoto por URL**, que es el camino principal: se pega la URL
  pública `https://<tu-dominio>/mcp` en los conectores de Claude, ChatGPT,
  Gemini o Grok y la plataforma maneja el diagrama abierto en tu navegador, sin
  correr nada en tu máquina. El diálogo revisa solo si el servidor tiene el
  conector configurado antes de darte la URL.
- Detrás de esa URL hay transporte Streamable HTTP y un servidor OAuth 2.1
  mínimo (`mcp/oauth.ts`): registro dinámico de clientes (RFC 7591), código de
  autorización con PKCE, refresh tokens rotativos y descubrimiento
  (RFC 8414 / 9728). Como no hay cuentas, el consentimiento es una frase de paso
  única, `OHMYDIAGRAMS_OWNER_TOKEN`, que se tipea del lado de la plataforma y
  nunca dentro de la app.
- **Puente local por stdio** para un agente que corre en tu máquina (Claude Code
  y compañía). Es opt-in desde el menú "Conexiones" y el socket escucha sólo en
  loopback.
- Las relaciones inválidas también se rechazan por estas dos vías, con la misma
  explicación de la regla que ve una persona. Ver [`mcp/README.md`](mcp/README.md).
- Todo el lado remoto queda inerte si no se define `OHMYDIAGRAMS_OWNER_TOKEN`:
  sin esa variable el servidor se comporta como siempre (stdio y WebSocket de
  loopback) y `/mcp` no existe.

**Modelo propio (avanzado)**
- La otra conexión saliente, ahora detrás del enlace "Avanzado" del menú
  "Conexiones": la app llamando a un modelo con tu propia clave.
- Cuatro botones de un clic (Claude, GPT, Gemini y Grok) completan la URL base y
  un modelo por defecto; el campo de URL cruda queda detrás de "Avanzado" para
  Ollama, vLLM, LM Studio, OpenRouter o un VPS propio.
- Sólo hace falta que responda en `POST {URL base}/chat/completions`. La URL se
  normaliza sola: `http://vps:11434`, `.../v1`, la ruta de compatibilidad de
  Gemini (`/v1beta/openai`) y la ruta completa son la misma cosa.
- "Probar conexión" hace una consulta mínima que valida URL, clave y modelo de
  una sola vez, y muestra el error del servidor tal como llega.
- Se usa para leer la especificación de requisitos: ahí el texto del archivo se
  envía a esa URL. El diagrama nunca sale del navegador. Si el modelo falla, la
  importación no se pierde: se avisa y se lee con el lector local.
- La configuración (clave incluida) vive en `localStorage` y las llamadas salen
  del navegador, así que el servidor tiene que permitir CORS desde el origen
  donde esté publicada la app.

**Persistencia y exportación**
- Autoguardado en `localStorage` con escritura diferida: un índice con la
  biblioteca (`ohmydiagrams:library:v1`) y un archivo por diagrama
  (`ohmydiagrams:doc:<id>`). El documento único de las versiones anteriores se
  migra solo al abrir la app.
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
bun run typecheck   # tsc -b (app, vite, mcp y tests)
bunx oxlint .       # linting
bun test            # tests unitarios
bun run build       # build de producción
```

Para exponer el lienzo a un agente, con la app abierta en el navegador:

```bash
bun run mcp
```

Eso levanta el puente local (stdio + WebSocket en `127.0.0.1:7823`). Para habilitar
además el conector remoto por URL, definí la frase de paso antes de arrancarlo:

```bash
OHMYDIAGRAMS_OWNER_TOKEN='una frase larga' bun run mcp
```

| Variable | Para qué |
| --- | --- |
| `OHMYDIAGRAMS_OWNER_TOKEN` | Habilita `/mcp` y el OAuth. Sin ella el conector remoto no existe. |
| `OHMYDIAGRAMS_BRIDGE_PORT` | Puerto del puente (por defecto `7823`). Va en los dos lados. |
| `OHMYDIAGRAMS_BRIDGE_HOST` | Interfaz donde escucha. Por defecto `127.0.0.1`; cambiala sólo detrás de un proxy. |

## Arquitectura

```
src/
  types/          Modelo de dominio: nodos y relaciones (uml.ts), identidad del
                  documento y de la biblioteca (document.ts)
  diagrams/       Registro de tipos de diagrama: paleta, reglas y guía de cada uno
  store/          Zustand: documento abierto, biblioteca, historial de undo/redo,
                  autoguardado, tema, vista y toasts
  uml/            Lógica pura: geometría, análisis del grafo, reglas y validación
  canvas/         Componentes de React Flow: nodos, relaciones, edición en línea
  ui/             Inicio y paneles: barra superior, paleta, propiedades, checklist
  export/         Renderizador SVG, rasterizador PNG y serialización JSON
  requirements/   Lectura de PDF/Markdown/TXT y extracción de casos de uso
  planilla/       Importación de una especificación en Markdown ya estructurada:
                  parser (parse.ts), ubicación determinista (layout.ts) y
                  rebanado por actor (slice.ts)
  llm/            Cliente de chat compatible con OpenAI y forma de la conexión
  bridge/         Protocolo y cliente del puente con el servidor MCP
scripts/          Utilidades de línea de comandos (planilla.ts)
mcp/              Servidor MCP: stdio (server.ts), WebSocket de loopback
                  (bridge.ts), endpoint remoto Streamable HTTP (mcpHttp.ts) y el
                  servidor OAuth 2.1 que lo protege (oauth.ts)
```

Cinco decisiones sostienen el resto:

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
4. **El tipo de diagrama vive en un registro, no en `if`s.** `diagrams/registry.ts`
   dice qué paleta, qué reglas y qué guía tiene cada tipo; la paleta, la
   checklist, el lienzo y el puente MCP leen de ahí. Agregar un tipo nuevo es
   agregar una entrada, no tocar los componentes.
5. **La biblioteca es la dueña del guardado.** El store del documento sólo
   conoce el diagrama abierto; `store/library.ts` escucha sus cambios y los
   escribe en el archivo del documento activo. Por eso abrir uno reinicia el
   historial: el undo nunca cruza de un diagrama a otro.

## Despliegue

El despliegue es automático: cada push a `main` dispara
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que corre en un
runner self-hosted y ejecuta el script de despliegue del servidor
(`~/deploy/ohmy.sh diagrams`). El workflow usa un grupo de concurrencia, así que
dos pushes seguidos no pisan un despliegue a medio hacer: el anterior se cancela.

Nada se despliega desde `dev`. El flujo es trabajar en `dev` y promover a `main`
cuando `bun run typecheck && bunx oxlint . && bun test && bun run build` pasan
limpio.

La aplicación es estática (`bun run build` deja todo en `dist/`), pero el
conector remoto de MCP **no** lo es: la app arma su URL como
`window.location.origin + '/mcp'`, así que para que ese camino funcione el
servidor tiene que, además de servir `dist/`, correr `bun mcp/server.ts` con
`OHMYDIAGRAMS_OWNER_TOKEN` definido y proxear hacia él `/mcp`, `/authorize`,
`/token`, `/register` y `/.well-known/oauth-*`. Sin eso la app sigue andando
entera y el diálogo del conector avisa que ese servidor todavía no lo tiene
configurado.

El puente escucha en `127.0.0.1` aunque la frase de paso esté definida, que es
lo que se quiere si el proxy corre en la misma máquina. Sólo si el proxy está en
otro host hace falta `OHMYDIAGRAMS_BRIDGE_HOST=0.0.0.0`, y en ese caso el puerto
no puede quedar expuesto directamente: `/mcp` pide token, pero el WebSocket del
puente no.

## Estado del proyecto

El alcance P0 está completo. Para retomar el trabajo (qué está verificado, qué
no, decisiones de arquitectura y trampas ya encontradas) ver
[`docs/ESTADO.md`](docs/ESTADO.md).

## Licencia

MIT
