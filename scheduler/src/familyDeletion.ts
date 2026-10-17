import type pg from 'pg'
import { log as defaultLog, type Log } from './log.js'

// Удаление семей по заявкам из таблицы `family_deletions` (их оставляет server, когда создатель просит удалить семью).
// Порядок важен: сначала файлы семьи в хранилище (сервис media), и только потом строки в базе. Если файлы удалить не вышло,
// семья остаётся и заявка повторяется позже (иначе файлы остались бы без записей, и их уже никто бы не убрал).
// Все таблицы семьи связаны каскадом: удаление строки `families` убирает участников, сессии, подписки, задания, чаты и сообщения,
// цели, монеты, события, приглашения и записи о медиа, а с ними и саму заявку.

export const FAMILY_DELETION_LOCK_KEY = 7_301_002
// не больше семей за один проход: удаление большой семьи не должно надолго занимать планировщик
const BATCH = 5
// паузы между повторами после сбоя: 1, 2, 4 … минут, но не дольше часа
const MAX_RETRY_MINUTES = 60

// Удаление файлов семьи в хранилище; повтор безопасен
export interface MediaCleaner {
  deleteFamily(familyId: string): Promise<void>
}

// Сервис media из окружения; null, если фото и файлы не настроены (тогда удалять в хранилище нечего)
export function mediaCleanerFromEnv(env: NodeJS.ProcessEnv = process.env, timeoutMs = 60_000): MediaCleaner | null {
  const token = env.MEDIA_INTERNAL_TOKEN
  if (!token) return null
  const base = (env.MEDIA_URL || 'http://media:3000').replace(/\/$/, '')
  return {
    async deleteFamily(familyId) {
      const res = await fetch(`${base}/internal/families/${familyId}`, {
        method: 'DELETE',
        headers: { 'x-internal-token': token },
        signal: AbortSignal.timeout(timeoutMs),
      })
      // 404 не бывает (повтор безопасен), остальное сбой: семью пока не трогаем
      if (!res.ok) throw new Error(`media delete failed: ${res.status}`)
    },
  }
}

export interface DeletionResult {
  deleted: number
  failed: number
}

// Один проход: исполняет заявки, срок которых пришёл. Только лидер (см. runFamilyDeletionsAsLeader).
export async function runFamilyDeletions(pool: pg.Pool, media: MediaCleaner | null, now = new Date(), log: Log = defaultLog): Promise<DeletionResult> {
  const { rows } = await pool.query<{ family_id: string; attempts: number }>(
    `select family_id, attempts from family_deletions where next_attempt_at <= $1 order by requested_at limit $2`,
    [now, BATCH],
  )
  const result = { deleted: 0, failed: 0 }
  for (const { family_id: familyId, attempts } of rows) {
    try {
      await media?.deleteFamily(familyId)
      const { rows: counted } = await pool.query<{ members: number }>('select count(*)::int as members from members where family_id = $1', [familyId])
      await pool.query('delete from families where id = $1', [familyId])
      result.deleted++
      // семью и её людей в журнале не называем: только число
      log('info', 'family_deleted', { familyId, members: counted[0].members })
    } catch (err) {
      result.failed++
      const message = (err as Error).message
      const pauseMinutes = Math.min(2 ** attempts, MAX_RETRY_MINUTES)
      await pool
        .query(
          `update family_deletions set attempts = attempts + 1, last_error = $2, next_attempt_at = $3::timestamptz + make_interval(mins => $4)
           where family_id = $1`,
          [familyId, message.slice(0, 500), now, pauseMinutes],
        )
        .catch(() => {})
      log('error', 'family_deletion_failed', { familyId, attempts: attempts + 1, error: message })
    }
  }
  return result
}

// Как runTickAsLeader: если несколько экземпляров планировщика, заявки исполняет один (рекомендательная блокировка)
export async function runFamilyDeletionsAsLeader(pool: pg.Pool, media: MediaCleaner | null, now = new Date(), log: Log = defaultLog): Promise<DeletionResult | null> {
  const client = await pool.connect()
  let locked = false
  let broken = false
  try {
    const { rows } = await client.query<{ locked: boolean }>('select pg_try_advisory_lock($1) as locked', [FAMILY_DELETION_LOCK_KEY])
    locked = rows[0].locked
    if (!locked) return null
    return await runFamilyDeletions(pool, media, now, log)
  } finally {
    if (locked) {
      try {
        await client.query('select pg_advisory_unlock($1)', [FAMILY_DELETION_LOCK_KEY])
      } catch {
        // не удалось снять: закрываем соединение, блокировка уйдёт вместе с ним
        broken = true
      }
    }
    client.release(broken)
  }
}
