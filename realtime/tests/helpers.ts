import { randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import { hashToken } from '../src/auth.js'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export interface TestMember {
  id: string
  token: string
}

export interface TestFamily {
  id: string
  mom: TestMember
  kid: TestMember
}

// Настоящая семья в тестовой БД: два участника и по сессии у каждого (токен приходит клиенту, в БД его хэш).
export async function createFamily(): Promise<TestFamily> {
  const suffix = randomUUID().slice(0, 8)
  const { rows } = await pool.query<{ id: string }>('insert into families (code) values ($1) returning id', [`rt${suffix}`])
  const familyId = rows[0].id
  const add = async (name: string, role: string, isOwner: boolean): Promise<TestMember> => {
    const { rows: m } = await pool.query<{ id: string }>(
      'insert into members (family_id, name, email, role, is_owner) values ($1, $2, $3, $4, $5) returning id',
      [familyId, name, `${name.toLowerCase()}-${suffix}@test.local`, role, isOwner],
    )
    return { id: m[0].id, token: await addSession(m[0].id) }
  }
  return { id: familyId, mom: await add('Мама', 'mama', true), kid: await add('Ребёнок', 'child', false) }
}

export async function addSession(memberId: string): Promise<string> {
  const token = randomBytes(24).toString('base64url')
  await pool.query('insert into sessions (member_id, token_hash) values ($1, $2)', [memberId, hashToken(token)])
  return token
}

export async function removeFamilies(...ids: string[]) {
  await pool.query('delete from families where id = any($1)', [ids])
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function waitFor<T>(check: () => Promise<T | false | undefined> | T | false | undefined, ms = 3000): Promise<T> {
  const deadline = Date.now() + ms
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > deadline) throw new Error('не дождались условия')
    await sleep(20)
  }
}
