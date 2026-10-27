import { createHash } from 'node:crypto'
import type pg from 'pg'

// Сессия без использования 90 дней истекает (как SESSION_TTL_DAYS в server/src/auth.ts).
export const SESSION_TTL_DAYS = 90

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export interface Authed {
  memberId: string
  familyId: string
  tokenHash: string
}

// Участник по токену сессии или null (токен приходит первым сообщением сокета, не в адресе).
export async function authenticate(pool: pg.Pool, token: string): Promise<Authed | null> {
  const tokenHash = hashToken(token)
  const { rows } = await pool.query<{ member_id: string; family_id: string | null }>(
    `select s.member_id, m.family_id
     from sessions s join members m on m.id = s.member_id
     where s.token_hash = $1 and s.last_used_at > now() - make_interval(days => $2)`,
    [tokenHash, SESSION_TTL_DAYS],
  )
  if (!rows[0]) return null
  // продлеваем не чаще раза в сутки, чтобы не писать в базу на каждое подключение
  void pool.query(`update sessions set last_used_at = now() where token_hash = $1 and last_used_at < now() - interval '1 day'`, [tokenHash]).catch(() => {})
  return { memberId: rows[0].member_id, familyId: rows[0].family_id ?? '', tokenHash }
}

// Какие из сессий ещё действуют (устройство вышло, участник или семья удалены, срок истёк: соединение надо закрыть) и чьи они сейчас.
// Участник без семьи (убранный из семьи взрослый) получает пустой familyId: соединение с прежней семьёй надо переоткрыть.
export async function liveSessions(pool: pg.Pool, tokenHashes: string[]): Promise<Map<string, { memberId: string; familyId: string }>> {
  if (tokenHashes.length === 0) return new Map()
  const { rows } = await pool.query<{ token_hash: string; member_id: string; family_id: string | null }>(
    `select s.token_hash, s.member_id, m.family_id
     from sessions s join members m on m.id = s.member_id
     where s.token_hash = any($1) and s.last_used_at > now() - make_interval(days => $2)`,
    [tokenHashes, SESSION_TTL_DAYS],
  )
  return new Map(rows.map((r) => [r.token_hash, { memberId: r.member_id, familyId: r.family_id ?? '' }]))
}
