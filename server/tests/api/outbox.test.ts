import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({ statusCode: 201 })) },
}))
vi.mock('../../src/mail.js', () => ({ sendCode: vi.fn(async () => {}) }))

import { pool } from '../../src/db.js'
import { sendCode } from '../../src/mail.js'
import { enqueue, enqueueToMember, PRIORITY } from '../../src/outbox/index.js'
import { createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { sendNotification, sentTo, subscribe } from '../webpush.js'

let fam: TestFamily

beforeAll(async () => {
  fam = await createFamily()
})
beforeEach(() => {
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
    expect(sentTo([endpoint]).map((s) => s.payload)).toEqual([message])
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

    expect(sentTo([own, second]).length).toBe(2)
    expect(sentTo([other])).toEqual([])
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
