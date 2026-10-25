import { randomBytes } from 'node:crypto'
import type { Readable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import { createSession } from '../src/auth.js'
import { pool } from '../src/db.js'

export interface TestMember {
  id: string
  name: string
  email: string
  token: string
}

export interface TestFamily {
  id: string
  mom: TestMember
  dad: TestMember
  kid: TestMember
  sis: TestMember
}

const uid = () => randomBytes(4).toString('hex')

// Семья из четырёх участников: мама (владелец), папа и двое детей, у каждого сессия. Создаётся прямо в БД, это быстро.
export async function createFamily(): Promise<TestFamily> {
  const suffix = uid()
  const { rows: [family] } = await pool.query(`insert into families (code) values ($1) returning id`, [`t${suffix}`])
  const add = async (name: string, role: string, isOwner = false): Promise<TestMember> => {
    const email = `${name.toLowerCase()}-${suffix}@test.local`
    const { rows } = await pool.query(
      `insert into members (family_id, name, email, role, is_owner) values ($1, $2, $3, $4, $5) returning id`,
      [family.id, name, email, role, isOwner],
    )
    return { id: rows[0].id, name, email, token: await createSession(pool, rows[0].id) }
  }
  return {
    id: family.id,
    mom: await add('Мама', 'mama', true),
    dad: await add('Папа', 'papa'),
    kid: await add('Ребёнок', 'child'),
    sis: await add('Сестра', 'child'),
  }
}

// Удаляет семьи вместе со всем, что к ним относится (каскадом).
export async function removeFamilies(...ids: string[]) {
  await pool.query('delete from families where id = any($1)', [ids])
}

export interface ApiResult {
  status: number
  body: any
}

// Вызов API без сети. token: токен сессии, null — без авторизации.
export async function api(
  app: FastifyInstance,
  token: string | null,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  payload?: unknown,
): Promise<ApiResult> {
  const res = await app.inject({
    method,
    url,
    payload: payload as object | undefined,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null }
}

// Дочитывает тело-поток до конца (подмены сервиса media получают файлы и видео потоком)
export async function drain(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of body) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}
