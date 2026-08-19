# Servidor MCP de Oh My Diagrams

Deja que un agente lea y edite el diagrama **abierto en el navegador**.

```
agente  ⇄ stdio ⇄  mcp/server.ts  ⇄ WebSocket ⇄  pestaña del navegador
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
