import type { GraphDriveItem, GraphListResponse } from './graphTypes'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Retry-After en segundos o fecha HTTP; devuelve ms a esperar o null. */
function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null
  const s = header.trim()
  if (/^\d+$/.test(s)) return parseInt(s, 10) * 1000
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return Math.max(0, t - Date.now())
  return null
}

/**
 * Petición Graph con reintentos ante **429** (throttling). Importante cuando
 * hay varios escaneos de raíz en paralelo (`LibraryPage`).
 */
export async function graphRequest(
  accessToken: string,
  pathOrUrl: string,
  init?: RequestInit,
): Promise<Response> {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `https://graph.microsoft.com/v1.0${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
  const maxAttempts = 5
  let last: Response | undefined
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
    })
    if (last.status !== 429) return last
    if (attempt === maxAttempts - 1) return last
    const fromHeader = parseRetryAfterMs(last.headers.get('Retry-After'))
    const backoff = fromHeader ?? Math.min(10_000, 500 * 2 ** attempt)
    await sleep(backoff)
  }
  return last!
}

export async function graphJson<T>(
  accessToken: string,
  pathOrUrl: string,
): Promise<T> {
  const res = await graphRequest(accessToken, pathOrUrl)
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Graph ${res.status}: ${t.slice(0, 400)}`)
  }
  return res.json() as Promise<T>
}

export async function listDriveChildren(
  accessToken: string,
  folderId: string,
  nextLink?: string,
): Promise<GraphListResponse<GraphDriveItem>> {
  const path =
    nextLink ??
    (folderId === 'root'
      ? '/me/drive/root/children?$top=200'
      : `/me/drive/items/${folderId}/children?$top=200`)
  return graphJson<GraphListResponse<GraphDriveItem>>(accessToken, path)
}

/** IDs de ítem pueden incluir `!`; deben ir codificados en la ruta. */
function driveItemPath(itemId: string, query?: string): string {
  const enc = encodeURIComponent(itemId)
  const q = query ? `?${query}` : ''
  return `/me/drive/items/${enc}${q}`
}

export async function getDriveItem(
  accessToken: string,
  itemId: string,
): Promise<GraphDriveItem> {
  return graphJson<GraphDriveItem>(accessToken, driveItemPath(itemId))
}

/**
 * Metadatos (faceta `audio`) sin depender del payload completo.
 * El reproductor sigue usando `getDriveItem` para incluir `downloadUrl`.
 */
export async function getDriveItemWithAudioSelect(
  accessToken: string,
  itemId: string,
): Promise<GraphDriveItem> {
  const sel = encodeURIComponent(
    'id,name,file,folder,parentReference,size,lastModifiedDateTime,audio',
  )
  return graphJson<GraphDriveItem>(
    accessToken,
    driveItemPath(itemId, `$select=${sel}`),
  )
}

export async function getDriveRoot(accessToken: string): Promise<GraphDriveItem> {
  return graphJson<GraphDriveItem>(accessToken, '/me/drive/root')
}
