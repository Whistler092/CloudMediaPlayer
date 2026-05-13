# Cloud Media Player — guía para agentes

Cliente web (Vite + React + TypeScript) para explorar OneDrive (Microsoft Graph), indexar audio en **Firebase Firestore** y reproducirlo con una **cola** en el cliente. Autenticación Microsoft vía **MSAL** (`@azure/msal-react`).

## Rutas de producto

| Ruta | Descripción |
|------|-------------|
| `/explorer` | Árbol OneDrive, escaneo a índice |
| `/library` | Biblioteca indexada (Firestore), búsqueda y paginación |
| `/playlists`, `/playlists/:id` | Playlists por usuario (`orderedTrackIds`) |

## Archivos clave

- **Shell y layout:** [`src/routes/AppShell.tsx`](src/routes/AppShell.tsx) — `main` + `PlayerQueuePanel`; estilos globales [`src/index.css`](src/index.css) (`main-queue-row`, `.page.*`, cola).
- **Reproductor:** [`src/player/PlayerContext.tsx`](src/player/PlayerContext.tsx) — cola, `playSingle` / `playQueue`, prefetch de siguiente pista, elemento `<audio>` oculto.
- **Biblioteca / índice:** [`src/pages/LibraryPage.tsx`](src/pages/LibraryPage.tsx), [`src/lib/indexedTrackSearch.ts`](src/lib/indexedTrackSearch.ts) — carga paginada del índice y filtros en cliente.
- **Playlists:** [`src/pages/PlaylistsPage.tsx`](src/pages/PlaylistsPage.tsx), [`src/pages/PlaylistDetailPage.tsx`](src/pages/PlaylistDetailPage.tsx).
- **Firestore paths:** [`src/firestore/paths.ts`](src/firestore/paths.ts).
- **Tipos documento:** [`src/types/firestore.ts`](src/types/firestore.ts) — `LibraryTrackDoc`, `PlaylistDoc`, etc.
- **Escaneo OneDrive → Firestore:** [`src/scan/scanDriveFolder.ts`](src/scan/scanDriveFolder.ts) y relacionados en `src/scan/`.

## Configuración

- Variables `VITE_FIREBASE_*` en `.env` para Firebase (biblioteca y playlists). Si faltan, la UI muestra aviso en shell.
- Graph: token vía MSAL; reproducción usa `@microsoft.graph.downloadUrl` del ítem.

## Reglas de Cursor del repo

Convenciones y detalle por área viven en **`.cursor/rules/*.mdc`** (resumen en cada archivo). Úsalas cuando el contexto coincida con los `globs` o cuando `alwaysApply` esté activo en la regla de overview.

## Skill del proyecto

Workflow y checklist: [`.cursor/skills/cloud-media-player/SKILL.md`](.cursor/skills/cloud-media-player/SKILL.md).

## Verificación habitual

Tras cambios relevantes: `npm run build` (incluye `tsc -b`).
