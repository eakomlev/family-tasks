import { randomInt, timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import type { PoolClient } from 'pg'
import { hashToken, memberToken } from './codes.js'
import { pool } from './db.js'

export type Purpose = 'signup' | 'login'
type Db = Pick<PoolClient, 'query'>

const CODE_TTL_MINUTES = 10
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_SECONDS = 60

export const CODE_TTL = CODE_TTL_MINUTES

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

const hashCode = (email: string, purpose: Purpose, code: string) =>
  hashToken(`${email}:${purpose}:${code}`)

// Возвращает код или null, если предыдущий выдан меньше минуты назад.
// Строка пишется для любого email (даже неизвестного), чтобы поведение не выдавало, есть ли он в системе.
export async function issueEmailCode(email: string, purpose: Purpose): Promise<string | null> {
  const recent = await pool.query(
    `select 1 from email_codes
     where email = $1 and purpose = $2 and created_at > now() - make_interval(secs => $3)`,
    [email, purpose, RESEND_COOLDOWN_SECONDS],
  )
  if (recent.rows[0]) return null

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await pool.query(
    `insert into email_codes (email, purpose, code_hash, expires_at)
     values ($1, $2, $3, now() + make_interval(mins => $4))
     on conflict (email, purpose) do update
       set code_hash = excluded.code_hash, attempts = 0,
           expires_at = excluded.expires_at, created_at = now()`,
    [email, purpose, hashCode(email, purpose, code), CODE_TTL_MINUTES],
  )
  return code
}

export async function discardEmailCode(db: Db, email: string, purpose: Purpose) {
  await db.query('delete from email_codes where email = $1 and purpose = $2', [email, purpose])
}

// Проверяет код, не сжигая его: удалить нужно после успешного действия (discardEmailCode).
export async function checkEmailCode(email: string, purpose: Purpose, code: string): Promise<boolean> {
  const { rows } = await pool.query(
    'select code_hash, attempts from email_codes where email = $1 and purpose = $2 and expires_at > now()',
    [email, purpose],
  )
  const row = rows[0]
  if (!row || row.attempts >= MAX_ATTEMPTS) return false

  const expected = Buffer.from(row.code_hash)
  const actual = Buffer.from(hashCode(email, purpose, code))
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual)
  if (!ok) {
    await pool.query('update email_codes set attempts = attempts + 1 where email = $1 and purpose = $2', [
      email,
      purpose,
    ])
  }
  return ok
}

// сессия устройства: клиент хранит токен, в БД только его хэш
export async function createSession(db: Db, memberId: string): Promise<string> {
  const token = memberToken()
  await db.query('insert into sessions (member_id, token_hash) values ($1, $2)', [
    memberId,
    hashToken(token),
  ])
  return token
}

export function bearerToken(req: FastifyRequest): string | null {
  return /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? null
}

// Срок жизни сессии без использования, дней; пока токеном пользуются, он продлевается
export const SESSION_TTL_DAYS = 90

// участник запроса вычисляется один раз: проверку делает общий хук (default-deny в app.ts), а обработчик берёт готовый результат
const resolved = new WeakMap<FastifyRequest, ReturnType<typeof authenticateToken>>()

export async function authenticate(req: FastifyRequest) {
  const cached = resolved.get(req)
  if (cached) return cached
  const token = bearerToken(req)
  const result = token ? authenticateToken(token) : Promise.resolve(null)
  resolved.set(req, result)
  return result
}

// Удаляет сессии, которыми не пользовались дольше срока (запускается при старте и раз в сутки).
export async function deleteExpiredSessions(): Promise<number> {
  const { rowCount } = await pool.query(`delete from sessions where last_used_at < now() - make_interval(days => $1)`, [SESSION_TTL_DAYS])
  return rowCount ?? 0
}

// участник по токену сессии или null (для HTTP по заголовку, для WebSocket по первому сообщению)
export async function authenticateToken(token: string) {
  const { rows } = await pool.query(
    `select m.id, m.name, m.role, m.is_owner, m.email, m.avatar, to_char(m.birth_date, 'YYYY-MM-DD') as birth_date, m.created_at, m.family_id, f.code as family_code
     from sessions s
     join members m on m.id = s.member_id
     join families f on f.id = m.family_id
     where s.token_hash = $1 and s.last_used_at > now() - make_interval(days => $2)`,
    [hashToken(token), SESSION_TTL_DAYS],
  )
  if (!rows[0]) return null
  // продлеваем не чаще раза в сутки, чтобы не писать в базу на каждый запрос
  void pool
    .query(`update sessions set last_used_at = now() where token_hash = $1 and last_used_at < now() - interval '1 day'`, [hashToken(token)])
    .catch(() => {})
  return rows[0]
}
