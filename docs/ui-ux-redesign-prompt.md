# Prompt de handoff: UI/UX — Cloud Media Player

Copia el bloque siguiente (desde **ROL** hasta el final) en tu herramienta de diseño o asistente de UI. Está redactado en español y describe solo **funcionalidad y comportamiento**; no impone stack visual concreto.

---

## ROL

Eres un diseñador/a de producto y UI/UX. Debes proponer o implementar una interfaz coherente, accesible y clara para una aplicación web ya existente. No debes eliminar capacidades descritas salvo que expliques el trade-off.

## PRODUCTO

**Nombre:** Cloud Media Player (repositorio local: reproductor de música en la nube).

**Propuesta de valor:** El usuario inicia sesión con **Microsoft (cuenta personal o laboral)** para acceder a **OneDrive** mediante **Microsoft Graph**, explora carpetas, **indexa** archivos de audio en **Firebase Firestore** (bajo un usuario anónimo vinculado a la sesión Microsoft), gestiona **playlists** persistidas en Firestore y **reproduce** audio con un reproductor HTML5 que obtiene URLs temporales de descarga desde Graph.

**Idioma de la UI actual:** Español (textos de botones, mensajes, placeholders).

## STACK TÉCNICO (CONSTRAINTS PARA UI)

- SPA **React** + **TypeScript**, enrutador **React Router**.
- Autenticación Microsoft: **MSAL** (`@azure/msal-react`), flujo actual de login principalmente **`loginRedirect`** (redirección full-page a Microsoft y vuelta al `redirectUri`, típicamente `http://localhost:5173/` en desarrollo).
- Tras MSAL, si Firebase está configurado, la app obtiene **Firebase Auth anónimo** para aislar datos por `firebaseUid`.
- Datos de biblioteca y playlists: **Firestore** (rutas bajo `users/{firebaseUid}/...`).
- Audio: elemento `<audio>` oculto + barra fija inferior cuando hay cola o pista actual.
- **PWA** (manifest + service worker): considerar estados offline limitados (la reproducción sigue dependiendo de red y tokens).

No necesitas conocer código; sí debes respetar que existen **dos “identidades”**: sesión Microsoft (Graph) y usuario Firebase anónimo (índice + playlists).

## ARQUITECTURA DE NAVEGACIÓN

- **Ruta pública:** `/login` — solo usuarios no autenticados con MSAL (o mensaje si falta configuración MSAL).
- **Rutas protegidas (requieren MSAL):** envueltas en layout con **cabecera global** y **barra de reproductor** cuando aplique.
  - `/` redirige a `/explorer`.
  - **`/explorer`** — Explorador OneDrive (árbol por “carpeta actual”, no es un tree view persistente: breadcrumb + lista de hijos).
  - **`/library`** — Biblioteca indexada (Firestore): pistas ya escaneadas + metadatos.
  - **`/playlists`** — Lista de playlists del usuario.
  - **`/playlists/:playlistId`** — Detalle de una playlist: orden, reproducción, edición rudimentaria.
- Cualquier otra ruta desconocida redirige a `/explorer`.

**Cabecera (App shell):**

- Marca / enlace a inicio (`/explorer`).
- Navegación principal: **Explorador**, **Biblioteca**, **Playlists**.
- Botón **Cerrar sesión Microsoft** (logout popup MSAL hacia `postLogoutRedirectUri` en origen).
- **Banner de aviso** si Firebase no está configurado: indica que la biblioteca indexada y playlists no estarán disponibles (la app sigue pudiendo explorar OneDrive y reproducir desde Graph si hay token).

## PANTALLA: LOGIN (`/login`)

**Objetivo:** Iniciar sesión con Microsoft.

**Contenido funcional:**

- Título de producto y texto explicativo (acceso a OneDrive para música).
- CTA principal: iniciar sesión (dispara `loginRedirect` a Microsoft).
- Texto de ayuda: variables de entorno `VITE_MSAL_CLIENT_ID` y documentación en repo (`docs/azure-app-setup.md`).
- En desarrollo, puede mostrarse una nota para mirar consola (`[AuthDebug]`, `[MSAL:event]`).

**Estados UX a contemplar:**

- Carga tras volver de Microsoft (hash/query limpiado por MSAL).
- Error de configuración (sin client id): pantalla sustituta “Missing MSAL config”.
- Errores de IdP en URL (`#error=...`): el usuario puede necesitar mensaje humano y acción (reintentar, revisar registro de app, InPrivate, etc.) — hoy parte de eso es consola + docs.

## PANTALLA: EXPLORADOR (`/explorer`)

**Objetivo:** Ver el **drive personal** (`/me/drive`), navegar carpetas y **reproducir o encolar** archivos de audio reconocidos; opcionalmente **iniciar un escaneo** que indexa en Firestore.

**Datos y controles:**

1. **Carga inicial:** Resuelve la raíz del drive (Graph), establece `folderId` y breadcrumb inicial “OneDrive”.
2. **Breadcrumb:** Cada segmento es clicable para “volver” a esa carpeta (trunca el trail después del índice elegido).
3. **Lista de ítems** de la carpeta actual (`children`, paginación con `@odata.nextLink`):
   - Carpetas: al hacer clic, **entrar** en la carpeta (actualiza `folderId` y breadcrumb).
   - Archivos: muestra nombre y tipo (mime o inferencia); si es **audio** (extensión o `mimeType` audio): acciones **Reproducir** (reemplaza cola con una sola pista y reproduce) y **Cola** (añade al final de la cola sin interrumpir lo que suene).
4. **“Cargar más”** si hay `nextLink` (misma carpeta, más páginas).
5. **Checkbox “Incluir subcarpetas al escanear”** — solo afecta al job de escaneo, no a la lista actual.
6. **Botón “Escanear esta carpeta”** — requiere Firebase listo + `firebaseUid` + instancia Firestore; si no, el botón va deshabilitado y hay copy de ayuda.
7. **Durante escaneo:** mensaje de progreso (pistas indexadas + detalle textual); botón **Cancelar escaneo** (abort signal). El escaneo escribe/actualiza un documento “raíz” en Firestore y hace crawl BFS con checkpoint en IndexedDB para reanudar; la UI solo refleja estado y progreso.

**Estados UX:**

- “Cargando…” mientras llega raíz o hijos.
- Errores de red / token: sin bloquear toda la app si es posible; el reproductor puede mostrar error en barra.
- Carpeta vacía: tabla vacía sin romper layout.

## PANTALLA: BIBLIOTECA (`/library`)

**Objetivo:** Ver pistas **ya indexadas** en Firestore (hasta ~500 documentos ordenados por nombre) y las **raíces escaneadas** (hasta ~50), con filtro textual.

**Secciones:**

1. **Raíces escaneadas:** lista con `displayPath`, `indexedTrackCount`, `scanStatus` (p. ej. running / completed / error / cancelled).
2. **Toolbar:** campo de búsqueda que filtra en cliente por nombre, artista o álbum.
3. **Tabla de pistas:** columnas nombre, artista, álbum; acciones **Reproducir** y **Cola** (misma semántica que en explorador, pero refs vienen del índice: `id` = id de ítem OneDrive / doc id según modelo actual).

**Estados UX:**

- Sin Firebase configurado: mensaje para configurar `.env`.
- Firebase aún no listo o sin `firebaseUid`: “Esperando autenticación Firebase…”.
- Sin raíces: copy “aún no hay carpetas indexadas”.
- Sin pistas tras filtro: vacío amable.

## PANTALLA: PLAYLISTS (`/playlists`)

**Objetivo:** CRUD mínimo de playlists.

**Funcionalidad:**

- Crear playlist: input nombre + botón **Crear** (deshabilitado si nombre vacío).
- Listar playlists ordenadas por `updatedAt` descendente; cada fila muestra nombre (enlace al detalle), número de temas, **Eliminar** con `confirm()` nativo.
- Sin Firebase / sin uid: mismos estados que Biblioteca.

## PANTALLA: DETALLE DE PLAYLIST (`/playlists/:playlistId`)

**Objetivo:** Ver orden de temas, reproducir, reordenar, quitar, añadir por id.

**Funcionalidad:**

- Cabecera con enlace “volver” a lista.
- **Reproducir todo:** construye cola con todos los `orderedTrackIds` resueltos a nombres (si el doc de pista existe en índice; si no, muestra el id como nombre) y llama a “play queue desde índice 0”.
- Tabla ordenada: #, nombre/id, acciones:
  - Subir / bajar en la lista (persiste `orderedTrackIds` en Firestore).
  - **▶** reproducir solo esa pista.
  - **Quitar** de la playlist (no borra el archivo en OneDrive ni el doc de biblioteca).
- **Añadir por id de OneDrive:** input `driveItemId` + **Añadir** — pensado para power users (copian id desde biblioteca o Graph). Persiste al final de la lista.

**Estados UX:**

- Playlist inexistente: mensaje + enlace volver.
- Cargando documento y resolución de nombres (N+1 lecturas Firestore): indicador de carga.

## REPRODUCTOR GLOBAL (Player bar)

**Visibilidad:** Oculto si no hay pista actual **y** la cola está vacía.

**Controles y datos mostrados:**

- Título (y artista si existe en `PlayerTrackRef`).
- **Anterior** / **Pausa–Reproducir** / **Siguiente** (anterior deshabilitado en primera pista; siguiente deshabilitado en última).
- Barra de progreso (`<input type="range">`) con tiempos `m:ss` / duración; seek actualiza `currentTime`.
- Mensaje de **error** si falla descarga URL, reproducción automática bloqueada, etc.

**Comportamiento funcional (para diseño de estados):**

- **Reproducir** una pista: cola = `[track]`, índice 0, se pide token silencioso MSAL, se llama Graph `GET /me/drive/items/{id}` para `@microsoft.graph.downloadUrl`, se asigna al `<audio>` y se intenta `play()`.
- **Cola:** añade al final; no cambia el índice actual ni interrumpe si ya suena otra.
- **Fin de pista:** avanza automáticamente a la siguiente si existe; si no, deja de reproducir.
- **Error de red en audio:** intenta “refrescar” misma pista (URLs de Graph son temporales).
- **Media Session API:** cuando Graph devuelve metadatos audio, se actualiza `navigator.mediaSession.metadata` (título/artista/álbum) para OS / Bluetooth / auto.

## MODELO DE DATOS (ALTO NIVEL, PARA COPY Y ESTADOS)

- **Graph:** carpetas y archivos OneDrive; audio detectado por extensión o mime.
- **Firestore (por `firebaseUid`):**
  - Raíces de biblioteca: path, estado de escaneo, conteos, timestamps.
  - Pistas indexadas: nombre, artista, álbum (si se extrajeron), referencia al ítem de drive.
  - Playlists: nombre, `orderedTrackIds[]`, timestamps.

## ACCESIBILIDAD Y UX TRANSVERSAL

- Tablas densas en Explorador, Biblioteca y Playlists: considerar vista lista/cards en móvil, ordenación explícita, estados vacíos, skeletons en lugar de solo “Cargando…”.
- Breadcrumbs: deben seguir siendo obvios en móvil (scroll horizontal, dropdown, etc.).
- **Toasts / banners** para éxito o error de escaneo, logout, fallos Graph (hoy mucho es implícito o consola).
- **Confirmaciones:** hoy se usa `confirm()` del navegador para borrar playlist — candidato a modal accesible.

## LO QUE NO ES REQUISITO DE ESTE PROMPT

- No rediseñar backend ni reglas de Firestore.
- No cambiar permisos Graph (User.Read, Files.Read, offline_access) salvo documentación aparte.
- No sustituir MSAL por otro proveedor en este prompt.

## REFERENCIA VISUAL ACTUAL (SOLO CONTEXTO, LIBRE DE CAMBIAR)

Tema oscuro aproximado: fondo `#0f1115`, superficies `#171b22`, texto claro, acentos tipo Material/Workspace (`#8ab4f8` en enlaces). Tipografía base sistema (`Segoe UI`, system-ui). Layout: cabecera fija, contenido con `max-width` ~1100px centrado, padding inferior extra para no tapar contenido con la barra del reproductor.

---

**Fin del prompt de funcionalidades.**
