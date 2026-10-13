import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({ statusCode: 201 })) },
}))
vi.mock('../../src/mail.js', () => ({ sendCode: vi.fn(async () => {}) }))

import { pool } from '../../src/db.js'
import { sendCode } from '../../src/mail.js'
import { enqueue, enqueueToMember, PRIORITY } from '../../src/outbox/index.js'
import { createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import webpush from 'web-push'
import { subscribe } from '../webpush.js'

const sendNotification = vi.mocked(webpush.sendNotification)
// отправленное напрямую (без очереди): адреса из вызовов подменённого web-push
const sentVia = (endpoints: string[]) =>
  sendNotification.mock.calls
    .filter(([sub]) => endpoints.includes((sub as { endpoint: string }).endpoint))
    .map(([sub, payload]) => ({ endpoint: (sub as { endpoint: string }).endpoint, payload: JSON.parse(String(payload)) }))

let fam: TestFamily

beforeAll(async () => {
  fam = await createFamily()
})
beforeEach(() => {
  // по умолчанию в тестах очередь включена; здесь сначала проверяем прямую отправку
  vi.stubEnv('QUEUE_ENABLED', 'false')
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 } as never)
  vi.mocked(sendCode).mockReset().mockResolvedValue(undefined)
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await pool.end()
})

const message = { title: 'Заголовок', body: 'Текст', url: '/tasks', tag: 'test' }
const subscriptionId = async (endpoint: string) =>
  (await pool.query('select id from push_subscriptions where endpoint = $1', [endpoint])).rows[0].id as string

describe('письмо', () => {
  const item = (to: string) =>
    ({ channel: 'email', priority: PRIORITY.code, payload: { v: 1, kind: 'code', to, code: '123456', ttlMinutes: 10 } }) as const

  it('отправляет код на адрес', async () => {
    expect(await enqueue(pool, item('a@test.local'))).toBe('sent')
    expect(sendCode).toHaveBeenCalledWith('a@test.local', '123456', 10)
  })

  it('ошибку отправки пробрасывает: при регистрации по ней отвечают 502', async () => {
    vi.mocked(sendCode).mockRejectedValueOnce(new Error('smtp down'))
    await expect(enqueue(pool, item('b@test.local'))).rejects.toThrow('smtp down')
  })
})

describe('push', () => {
  it('отправляет сообщение на подписку', async () => {
    const endpoint = await subscribe(fam.kid.id)
    const result = await enqueue(pool, {
      channel: 'push',
      priority: PRIORITY.event,
      payload: { v: 1, subscriptionId: await subscriptionId(endpoint), message },
    })
    expect(result).toBe('sent')
    expect(sentVia([endpoint]).map((s) => s.payload)).toEqual([message])
  })

  it('подписки уже нет: ничего не уходит, итог gone', async () => {
    const result = await enqueue(pool, {
      channel: 'push',
      priority: PRIORITY.event,
      payload: { v: 1, subscriptionId: randomUUID(), message },
    })
    expect(result).toBe('gone')
    expect(sendNotification).not.toHaveBeenCalled()
  })
})

describe('enqueueToMember', () => {
  it('отправляет на все устройства участника и не трогает чужие', async () => {
    const own = await subscribe(fam.mom.id)
    const second = `https://push.test/${fam.mom.id}-second`
    await pool.query(
      `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone) values ($1, $2, 'p', 'a', 'UTC')`,
      [fam.mom.id, second],
    )
    const other = await subscribe(fam.dad.id)

    await enqueueToMember(pool, fam.mom.id, message)

    expect(sentVia([own, second]).length).toBe(2)
    expect(sentVia([other])).toEqual([])
  })

  it('у участника нет подписок: тихо ничего не делает', async () => {
    await expect(enqueueToMember(pool, fam.sis.id, message)).resolves.toBeUndefined()
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('ошибка базы не пробрасывается: основное действие не ломается', async () => {
    const broken = { query: async () => { throw new Error('db down') } } as unknown as typeof pool
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(enqueueToMember(broken, fam.mom.id, message)).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('notify failed', 'db down')
    log.mockRestore()
  })
})

describe('очередь (QUEUE_ENABLED=true)', () => {
  beforeEach(() => {
    vi.stubEnv('QUEUE_ENABLED', 'true')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  // payload читает сервис notifier: тот же пример проверяет его контракт (notifier/tests/unit/contract.test.ts)
  const emailPayload = { v: 1, kind: 'code', to: 'q@test.local', code: '123456', ttlMinutes: 10 }
  const rowFor = async (match: string) =>
    (await pool.query(`select * from outbox where payload::text like $1 order by id desc limit 1`, [`%${match}%`])).rows[0]

  it('письмо: строка в очереди, прямой отправки нет', async () => {
    const result = await enqueue(pool, { channel: 'email', priority: PRIORITY.code, payload: emailPayload as never })
    expect(result).toBe('queued')
    expect(sendCode).not.toHaveBeenCalled()

    const row = await rowFor('q@test.local')
    expect(row).toMatchObject({ channel: 'email', priority: 0, attempts: 0, last_error: null })
    expect(row.payload).toEqual(emailPayload)
    // срок жизни равен сроку кода: 10 минут
    const ttl = (new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()) / 1000
    expect(ttl).toBeGreaterThan(590)
    expect(ttl).toBeLessThan(610)
    await pool.query('delete from outbox where id = $1', [row.id])
  })

  it('push: строка с сообщением и подпиской, срок 6 часов', async () => {
    const endpoint = await subscribe(fam.kid.id)
    const id = await subscriptionId(endpoint)
    const result = await enqueue(pool, { channel: 'push', priority: PRIORITY.planned, payload: { v: 1, subscriptionId: id, message } })
    expect(result).toBe('queued')
    expect(sendNotification).not.toHaveBeenCalled()

    const row = await rowFor(id)
    expect(row).toMatchObject({ channel: 'push', priority: 2 })
    expect(row.payload).toEqual({ v: 1, subscriptionId: id, message })
    const ttl = (new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()) / 1000
    expect(Math.round(ttl / 3600)).toBe(6)
    await pool.query('delete from outbox where id = $1', [row.id])
  })

  it('enqueueToMember: по строке на каждую подписку участника', async () => {
    await subscribe(fam.dad.id)
    await pool.query(
      `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone) values ($1, $2, 'p', 'a', 'UTC')`,
      [fam.dad.id, `https://push.test/${fam.dad.id}-second`],
    )
    const ids = (await pool.query('select id from push_subscriptions where member_id = $1', [fam.dad.id])).rows.map((r) => r.id)

    await enqueueToMember(pool, fam.dad.id, message)

    const rows = (await pool.query(`select id, payload from outbox where payload->>'subscriptionId' = any($1)`, [ids])).rows
    expect(rows.map((r) => r.payload.subscriptionId).sort()).toEqual([...ids].sort())
    await pool.query('delete from outbox where id = any($1)', [rows.map((r) => r.id)])
  })

  it('будит notifier: сигнал outbox с id строки приходит после вставки', async () => {
    const listener = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await listener.connect()
    try {
      await listener.query('listen outbox')
      const got = new Promise<string>((resolve) => listener.once('notification', (n) => resolve(n.payload ?? '')))
      await enqueue(pool, { channel: 'email', priority: PRIORITY.code, payload: { ...emailPayload, to: 'notify@test.local' } as never })
      const row = await rowFor('notify@test.local')
      expect(await Promise.race([got, new Promise<string>((r) => setTimeout(() => r('timeout'), 3000))])).toBe(String(row.id))
      await pool.query('delete from outbox where id = $1', [row.id])
    } finally {
      await listener.end()
    }
  })

  it('внутри транзакции: откат убирает и строку очереди', async () => {
    const client = await pool.connect()
    try {
      await client.query('begin')
      await enqueue(client, { channel: 'email', priority: PRIORITY.code, payload: { ...emailPayload, to: 'rollback@test.local' } as never })
      await client.query('rollback')
    } finally {
      client.release()
    }
    expect(await rowFor('rollback@test.local')).toBeUndefined()
  })
})
