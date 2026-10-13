import type { Pool } from 'pg'
import type { MediaClient } from './client.js'

// Загружено, но так и не прикреплено к сообщению дольше суток: убираем файл и запись.
// Если сервис media недоступен, запись остаётся и будет убрана в следующий раз (иначе файл осиротел бы навсегда).
export async function deleteOrphanMedia(
  db: Pick<Pool, 'query'>,
  client: MediaClient,
  now = new Date(),
  onError: (err: unknown) => void = () => {},
): Promise<number> {
  const { rows } = await db.query<{ id: string; familyId: string }>(
    `select id, family_id as "familyId" from media
     where attached_at is null and created_at < $1::timestamptz - interval '1 day' limit 500`,
    [now],
  )
  let removed = 0
  for (const row of rows) {
    try {
      await client.delete(row.familyId, row.id)
      await db.query('delete from media where id = $1 and attached_at is null', [row.id])
      removed++
    } catch (err) {
      onError(err)
    }
  }
  return removed
}
