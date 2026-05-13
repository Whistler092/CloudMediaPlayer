import { graphRequest } from '../api/graphClient'
import type { GraphDriveItem } from '../api/graphTypes'
import jsmediatags from 'jsmediatags'

/** Primer chunk: suele bastar para cabecera ID3v2 + tags sin portada enorme. */
const INITIAL_END = 65535 // bytes=0-65535 → 64 KiB

/** Si moov/FLAC metadata no caben en 64 KiB, un solo refuerzo (evita el patrón 2 MiB × archivo). */
const FALLBACK_END = 524287 // 512 KiB

/** Tope por seguridad si el tamaño declarado en ID3 está corrupto o es absurdo. */
const MAX_ID3_TAG_BYTES = 8 * 1024 * 1024

function strTag(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') {
    const s = v.trim()
    return s || undefined
  }
  if (typeof v === 'object' && 'data' in (v as object)) {
    const d = (v as { data: unknown }).data
    if (typeof d === 'string') {
      const s = d.trim()
      return s || undefined
    }
  }
  return undefined
}

function readId3FromBuffer(buf: ArrayBuffer): Promise<{ title?: string; artist?: string; album?: string }> {
  return new Promise((resolve) => {
    const blob = new Blob([buf])
    jsmediatags.read(blob, {
      onSuccess: (tag) => {
        const t = tag.tags as Record<string, unknown>
        resolve({
          title: strTag(t.title),
          artist: strTag(t.artist) ?? strTag(t.TPE1) ?? strTag(t.TPE2),
          album: strTag(t.album),
        })
      },
      onError: () => resolve({}),
    })
  })
}

function id3SupportedExt(ext: string): boolean {
  const e = ext.toLowerCase()
  return e === 'mp3' || e === 'flac' || e === 'm4a' || e === 'aac'
}

/**
 * Tamaño total del bloque ID3v2 desde el byte 0 (cabecera 10 B + cuerpo declarado + footer opcional v2.4).
 * null si no hay prefijo ID3v2 reconocible.
 */
function id3DeclaredTagTotalBytes(u: Uint8Array): number | null {
  if (u.length < 10) return null
  if (u[0] !== 0x49 || u[1] !== 0x44 || u[2] !== 0x33) return null
  const ver = u[3]
  let body = 0
  if (ver === 2) {
    if (u.length < 9) return null
    body =
      ((u[6]! & 0x7f) << 14) |
      ((u[7]! & 0x7f) << 7) |
      (u[8]! & 0x7f)
  } else if (ver === 3 || ver === 4) {
    body =
      ((u[6]! & 0x7f) << 21) |
      ((u[7]! & 0x7f) << 14) |
      ((u[8]! & 0x7f) << 7) |
      (u[9]! & 0x7f)
  } else {
    return null
  }
  const footer = ver === 4 && u.length > 5 && (u[5]! & 0x10) !== 0 ? 10 : 0
  const total = 10 + body + footer
  if (!Number.isFinite(total) || total < 10) return null
  return Math.min(total, MAX_ID3_TAG_BYTES)
}

async function fetchContentPrefix(
  accessToken: string,
  encItemId: string,
  endInclusive: number,
): Promise<ArrayBuffer | null> {
  const res = await graphRequest(accessToken, `/me/drive/items/${encItemId}/content`, {
    headers: { Range: `bytes=0-${endInclusive}` },
  })
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  return buf.byteLength ? buf : null
}

function tagsEmpty(t: { title?: string; artist?: string; album?: string }): boolean {
  return !t.artist && !t.album && !t.title
}

/**
 * Si Microsoft Graph no expone `audio`, lee etiquetas ID3/MP4 del inicio del archivo vía Graph `content` + Range.
 * Estrategia: 64 KiB primero; si ID3v2 declara un tag más grande, un segundo Range del tamaño exacto (hasta tope).
 */
export async function enrichDriveItemFromId3Range(
  accessToken: string,
  item: GraphDriveItem,
): Promise<GraphDriveItem> {
  if (item.folder) return item
  const dot = item.name.lastIndexOf('.')
  const ext = dot >= 0 ? item.name.slice(dot + 1) : ''
  if (!id3SupportedExt(ext)) return item

  const enc = encodeURIComponent(item.id)

  let buf = await fetchContentPrefix(accessToken, enc, INITIAL_END)
  if (!buf || buf.byteLength < 10) return item

  const u0 = new Uint8Array(buf)
  const hasId3Prefix =
    u0.length >= 3 && u0[0] === 0x49 && u0[1] === 0x44 && u0[2] === 0x33
  const declared = id3DeclaredTagTotalBytes(u0)
  if (declared != null && declared > buf.byteLength) {
    const full = await fetchContentPrefix(accessToken, enc, declared - 1)
    // Solo sustituir si realmente creció el cuerpo; si Graph devuelve un 206 corto,
    // `>=` dejaría el buffer incompleto y jsmediatags quedaría sin artista/álbum.
    if (full && full.byteLength > buf.byteLength) buf = full
  }

  let tags = await readId3FromBuffer(buf)
  const extLower = ext.toLowerCase()
  if (tagsEmpty(tags) && declared == null && (extLower === 'm4a' || extLower === 'aac' || extLower === 'flac')) {
    const big = await fetchContentPrefix(accessToken, enc, FALLBACK_END)
    if (big && big.byteLength > buf.byteLength) {
      buf = big
      tags = await readId3FromBuffer(buf)
    }
  }

  const id3LikelyComplete = declared != null && buf.byteLength >= declared
  if (
    tagsEmpty(tags) &&
    extLower === 'mp3' &&
    !id3LikelyComplete &&
    (hasId3Prefix || declared != null)
  ) {
    if (buf.byteLength < FALLBACK_END + 1) {
      const mid = await fetchContentPrefix(accessToken, enc, FALLBACK_END)
      if (mid && mid.byteLength > buf.byteLength) {
        buf = mid
        tags = await readId3FromBuffer(buf)
      }
    }
    if (tagsEmpty(tags) && buf.byteLength < 2097152) {
      const huge = await fetchContentPrefix(accessToken, enc, 2097151)
      if (huge && huge.byteLength > buf.byteLength) {
        buf = huge
        tags = await readId3FromBuffer(buf)
      }
    }
  }

  if (tagsEmpty(tags)) return item

  const mergedAudio: NonNullable<GraphDriveItem['audio']> = {
    ...(item.audio ?? {}),
    title: tags.title ?? item.audio?.title,
    artist: tags.artist ?? item.audio?.artist,
    album: tags.album ?? item.audio?.album,
    duration: item.audio?.duration,
  }
  return { ...item, audio: mergedAudio }
}
