# Servidor MCP de Oh My Diagrams

Deja que un agente lea y edite el diagrama **abierto en el navegador**.

Hay dos caminos hacia el mismo lienzo:

```
agente local     ⇄ stdio ⇄                      ┐
                                 mcp/server.ts ⇄ WebSocket ⇄ pestaña del navegador
Claude / ChatGPT ⇄ HTTPS /mcp ⇄ (OAuth 2.1)     ┘
```

El documento vive en el navegador y en ningún otro lado. El servidor no guarda
estado: cada herramienta es una ida y vuelta contra el lienzo, y cada cambio
pasa por las mismas acciones del store que usa la interfaz, así que queda en el
mismo historial de deshacer y en el mismo autoguardado que una edición a mano.

## Uso

1. Levantá la app (`bun dev`) y abrila en el navegador.
2. Registrá el servidor en Claude Code:

```bash
claude mcp add ohmydiagrams -- bun E:/Proyectos/OhMyOrg/ohmydiagrams/mcp/server.ts
```

3. En la barra superior de la app, tocá el enchufe. Se pone verde cuando el
   lienzo queda conectado.

El socket escucha sólo en `127.0.0.1:7823`, la conexión la inicia el navegador
y el botón es opt-in: nada se conecta sin que lo pidas. Para cambiar el puerto,
definí `OHMYDIAGRAMS_BRIDGE_PORT` en los dos lados.

## Conector remoto (Claude, ChatGPT, Gemini, Grok)

Esas cuatro plataformas aceptan un servidor MCP remoto pegando una URL pública,
sin nada corriendo en la máquina del usuario. Para habilitarlo alcanza con
definir una frase de paso antes de arrancar el servidor:

```bash
OHMYDIAGRAMS_OWNER_TOKEN='una frase larga' bun mcp/server.ts
```

Con esa variable, el mismo proceso empieza a atender HTTP en el puerto del
puente:

| Ruta | Qué es |
| --- | --- |
| `/mcp` | El servidor MCP, transporte Streamable HTTP, un `McpServer` por sesión |
| `/.well-known/oauth-authorization-server` | Descubrimiento del AS (RFC 8414) |
| `/.well-known/oauth-protected-resource[/mcp]` | Descubrimiento del recurso (RFC 9728) |
| `/register` | Registro dinámico de clientes (RFC 7591) |
| `/authorize` | Página de consentimiento: pide la frase de paso |
| `/token` | Código de autorización con PKCE y refresh rotativo |

Poné esto detrás de HTTPS (las plataformas no aceptan otra cosa) y en la app
pegá `https://<tu-dominio>/mcp`. El diálogo "Conectar tu plataforma de IA" te da
la URL ya armada y avisa si el servidor todavía no tiene el conector activo.

Tres cosas que conviene tener claras:

- **Sin `OHMYDIAGRAMS_OWNER_TOKEN` no existe nada de esto.** El servidor arranca
  igual que siempre, con stdio y el WebSocket de loopback, y `/mcp` responde 404.
- **No hay cuentas.** La frase de paso *es* la autorización, y se tipea en la
  página de consentimiento de este servidor, nunca dentro de la app.
- **El estado es en memoria**, igual que el resto de `mcp/`: un reinicio borra
  los clientes registrados y todos los tokens, y hay que volver a autorizar.
- **Sigue escuchando en loopback**, incluso con la frase de paso definida. Si el
  proxy inverso corre en la misma máquina no hay nada que hacer. Si está en otro
  host o en otro contenedor, hace falta además
  `OHMYDIAGRAMS_BRIDGE_HOST=0.0.0.0`, y entonces el puerto no puede quedar
  abierto al mundo, porque el WebSocket del puente (`/bridge`) no pide token.

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| `get_diagram` | Título, descripción, nodos y relaciones con sus ids |
| `get_validation` | Las 17 reglas UML 2.5 evaluadas contra el diagrama abierto |
| `add_node` | Agrega actor, caso de uso, límite, nota, texto o forma básica |
| `add_edge` | Conecta dos elementos; si viola UML 2.5 falla y explica la regla |
| `update_node` | Renombra y/o mueve una forma |
| `delete_elements` | Borra nodos y relaciones por id |
| `set_meta` | Título y descripción del diagrama |
| `insert_skeleton` | Inserta el esqueleto de ejemplo (límite, actor, 3 casos de uso) |
| `clear_diagram` | Vacía el lienzo (deshacible con ⌘Z) |

Las relaciones inválidas no se crean: `add_edge` devuelve el mismo texto que ve
una persona al intentar el arrastre, por ejemplo *"Una asociación no une dos
casos de uso. Usá «include», «extend» o Generalización."*
