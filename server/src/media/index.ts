import type { Pool, PoolClient } from 'pg'
import { expiryFor, sign } from './sign.js'

type Db = Pick<Pool | PoolClient, 'query'>

// Фото сообщения в ответах API: размеры известны заранее (лента не прыгает), адреса подписаны.
export interface MediaDto {
  id: string
  width: number
  height: number
  thumbUrl: string
  fullUrl: string
}

// Не больше фото в одном сообщении и размер файла после сжатия на клиенте.
export const MAX_PHOTOS = 10
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024
// Сколько места занимает семья (полноразмерные варианты), по умолчанию 2 ГБ.
export const mediaQuotaBytes = () => {
  const n = Number(process.env.MEDIA_QUOTA_BYTES)
  return Number.isFinite(n) && n > 0 ? n : 2 * 1024 * 1024 * 1024
}

export function mediaUrls(secret: string, family: string, id: string, now: Date): { thumbUrl: string; fullUrl: string } {
  const exp = expiryFor(now)
  const query = `?exp=${exp}&sig=${sign(secret, family, id, exp)}`
  return { thumbUrl: `/media/${family}/${id}/thumb${query}`, fullUrl: `/media/${family}/${id}/full${query}` }
}

// Заглушка в text для сообщения только с фото (видит старая версия клиента): «📷 Фото» или «📷 Фото ×3».
export const photoPlaceholder = (count: number) => (count === 1 ? '📷 Фото' : `📷 Фото ×${count}`)

// Фото сообщений одним запросом: сообщение -> фото по порядку. secret null (фото не настроены): адреса не строятся, фото нет.
export async function loadMedia(
  db: Db,
  secret: string | null,
  messageIds: string[],
  now = new Date(),
): Promise<Map<string, MediaDto[]>> {
  const out = new Map<string, MediaDto[]>()
  if (messageIds.length === 0 || !secret) return out
  const { rows } = await db.query<{ messageId: string; id: string; familyId: string; width: number; height: number }>(
    `select mm.message_id as "messageId", m.id, m.family_id as "familyId", m.width, m.height
     from message_media mm join media m on m.id = mm.media_id
     where mm.message_id = any($1) order by mm.message_id, mm.position`,
    [messageIds],
  )
  for (const r of rows) {
    const list = out.get(r.messageId) ?? []
    list.push({ id: r.id, width: r.width, height: r.height, ...mediaUrls(secret, r.familyId, r.id, now) })
    out.set(r.messageId, list)
  }
  return out
}
