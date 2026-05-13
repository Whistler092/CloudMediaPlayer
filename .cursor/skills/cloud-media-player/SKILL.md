---
name: cloud-media-player
description: >-
  Trabajar en Cloud Media Player (React/Vite): playlists, biblioteca indexada,
  reproductor/cola, shell y escaneo Firestore. Usar cuando se toquen rutas
  /playlists, /library, /explorer, PlayerContext, scan o firestore paths.
---

# Cloud Media Player — skill de proyecto

## Antes de implementar

1. Leer **[`AGENTS.md`](../../../AGENTS.md)** del repo (mapa de rutas y stack).
2. Si el cambio toca archivos bajo globs de **`.cursor/rules/`**, seguir esas reglas (`playlists-ui`, `player-queue`, `indexed-library`, `layout-shell`, `scan-firestore`, `media-player-overview`).

## Convenciones

- **Firestore:** usar helpers de [`src/firestore/paths.ts`](../../../src/firestore/paths.ts); tipos en [`src/types/firestore.ts`](../../../src/types/firestore.ts).
- **Reproducción:** no duplicar lógica de URL Graph fuera de [`PlayerContext.tsx`](../../../src/player/PlayerContext.tsx); cola = `playSingle` (una pista) vs `playQueue` (varias; permite prefetch de siguiente).
- **Playlists:** mutaciones de orden con `updateDoc` + `orderedTrackIds` y `serverTimestamp`; tras escribir, `load()` para refrescar filas desde lib tracks.
- **UI lista/cola:** iconos con `aria-label` / `title`; estados de carga en botones que disparan escrituras lentas (Firestore).
- **CSS:** respetar patrones de `.page.*` y `main-queue-row`; no reintroducir `flex: 1` genérico en dos `.tbl-wrap` competidores en la misma página sin clase dedicada.

## Verificación

- Ejecutar **`npm run build`** al cerrar un cambio que afecte TS o imports.

## No hacer

- No pedir al usuario comandos que puedas ejecutar tú en el entorno con shell.
- No expandir el alcance a refactors no pedidos; mantener cambios alineados con la tarea.
