import { randomBytes } from 'node:crypto'
import pg from 'pg'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const uid = () => randomBytes(4).toString('hex')

export interface TestMember {
  id: string
  name: string
}

export interface TestFamily {
  id: string
  mom: TestMember
  dad: TestMember
  kid: TestMember
  sis: TestMember
}

// Семья из четырёх участников: мама (владелец), папа и двое детей. Создаётся прямо в БД (схема server).
export async function createFamily(): Promise<TestFamily> {
  const suffix = uid()
  const { rows: [family] } = await pool.query(`insert into families (code) values ($1) returning id`, [`s${suffix}`])
  const add = async (name: string, role: string, isOwner = false): Promise<TestMember> => {
    const { rows } = await pool.query(
      `insert into members (family_id, name, email, role, is_owner) values ($1, $2, $3, $4, $5) returning id`,
      [family.id, name, `${name.toLowerCase()}-${suffix}@test.local`, role, isOwner],
    )
    return { id: rows[0].id, name }
  }
  return {
    id: family.id,
    mom: await add('Мама', 'mama', true),
    dad: await add('Папа', 'papa'),
    kid: await add('Ребёнок', 'child'),
    sis: await add('Сестра', 'child'),
  }
}

export async function removeFamilies(...ids: string[]) {
  await pool.query('delete from families where id = any($1)', [ids])
}

export interface Sent {
  endpoint: string
  payload: { title: string; body: string; url: string; tag: string }
}

// Адреса, подписанные через subscribe() этим файлом тестов.
const mine = new Set<string>()

// Что поставлено в очередь для указанных адресов (notifier отправляет, scheduler только ставит).
export async function sentTo(endpoints: string[]): Promise<Sent[]> {
  const { rows } = await pool.query(
    `select s.endpoint, o.payload->'message' as message
       from outbox o join push_subscriptions s on s.id = (o.payload->>'subscriptionId')::uuid
      where o.channel = 'push' and s.endpoint = any($1)
      order by o.id`,
    [endpoints],
  )
  return rows.map((r) => ({ endpoint: r.endpoint, payload: r.message }))
}

export async function resetSent(): Promise<void> {
  await pool.query(
    `delete from outbox o using push_subscriptions s
      where o.channel = 'push' and s.id = (o.payload->>'subscriptionId')::uuid and s.endpoint = any($1)`,
    [[...mine]],
  )
}

export async function subscribe(memberId: string, timeZone = 'UTC'): Promise<string> {
  const endpoint = `https://push.test/${memberId}`
  mine.add(endpoint)
  await pool.query(
    `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone) values ($1, $2, 'p256dh', 'auth', $3)
     on conflict (endpoint) do update set time_zone = excluded.time_zone`,
    [memberId, endpoint, timeZone],
  )
  return endpoint
}
