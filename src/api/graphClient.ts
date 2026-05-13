import type { GraphDriveItem, GraphListResponse } from './graphTypes'

export async function graphRequest(
  accessToken: string,
  pathOrUrl: string,
  init?: RequestInit,
): Promise<Response> {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `https://graph.microsoft.com/v1.0${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })
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
