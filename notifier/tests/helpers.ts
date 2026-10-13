import { randomBytes } from 'node:crypto'
import pg from 'pg'
import type { Db } from '../src/db.js'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const uid = () => randomBytes(4).toString('hex')

// Участник с семьёй, чтобы можно было завести push-подписку (внешние ключи схемы server).
export async function createMember(db: Db = pool): Promise<{ familyId: string; memberId: string }> {
  const suffix = uid()
  const { rows: [family] } = await db.query(`insert into families (code) values ($1) returning id`, [`n${suffix}`])
  const { rows: [member] } = await db.query(
    `insert into members (family_id, name, email, role, is_owner) values ($1, 'Тест', $2, 'mama', true) returning id`,
    [family.id, `n-${suffix}@test.local`],
  )
  return { familyId: family.id, memberId: member.id }
}

export async function subscribe(memberId: string, endpoint = `https://push.test/${uid()}`): Promise<{ id: string; endpoint: string }> {
  const { rows } = await pool.query(
    `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone) values ($1, $2, 'p', 'a', 'UTC') returning id`,
    [memberId, endpoint],
  )
  return { id: rows[0].id, endpoint }
}

export async function removeFamily(familyId: string) {
  await pool.query('delete from families where id = $1', [familyId])
}

export async function clearOutbox() {
  await pool.query('delete from outbox')
}

export interface NewRow {
  channel?: 'email' | 'push'
  priority?: number
  payload?: unknown
  attempts?: number
  nextAttemptAt?: Date
  expiresAt?: Date
}

export const emailPayload = (to = 'a@test.local') => ({ v: 1, kind: 'code', to, code: '123456', ttlMinutes: 10 })

// Строка очереди, как её кладёт server.
export async function insertRow(row: NewRow = {}): Promise<string> {
  const { rows } = await pool.query(
    `insert into outbox (channel, priority, payload, attempts, next_attempt_at, expires_at)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      row.channel ?? 'email',
      row.priority ?? 1,
      JSON.stringify(row.payload ?? emailPayload()),
      row.attempts ?? 0,
      row.nextAttemptAt ?? new Date(0),
      row.expiresAt ?? new Date('2100-01-01'),
    ],
  )
  return rows[0].id
}

export const rowById = async (id: string) => (await pool.query('select * from outbox where id = $1', [id])).rows[0]
