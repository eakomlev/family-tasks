import { readFileSync } from 'node:fs'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { pool } from '../../src/db.js'
import { enqueue, enqueueToMember, PRIORITY } from '../../src/outbox/index.js'
import { createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

let fam: TestFamily

beforeAll(async () => {
  fam = await createFamily()
})
afterAll(async () => {
  await resetSent()
  await removeFamilies(fam.id)
  await pool.end()
})

// общий образец payload очереди (его проверяет и notifier)
const sample = JSON.parse(readFileSync(new URL('../../../contracts/outbox-v1.json', import.meta.url), 'utf8'))
const message = sample.message
const subscriptionId = async (endpoint: string) =>
  (await pool.query('select id from push_subscriptions where endpoint = $1', [endpoint])).rows[0].id as string

describe('enqueueToMember', () => {
  it('ставит по сообщению на каждое устройство участника и не трогает чужие', async () => {
    const own = await subscribe(fam.mom.id)
    const second = `https://push.test/${fam.mom.id}-second`
    await pool.query(
      `insert into push_subscriptions (member_id, endpoint, p256dh, auth, time_zone) values ($1, $2, 'p', 'a', 'UTC')`,
      [fam.mom.id, second],
    )
    const other = await subscribe(fam.dad.id)

    await enqueueToMember(pool, fam.mom.id, message)

    expect((await sentTo([own, second])).length).toBe(2)
    expect(await sentTo([other])).toEqual([])
    await pool.query('delete from outbox where payload->>\'subscriptionId\' in (select id::text from push_subscriptions where endpoint = $1)', [second])
  })

  it('у участника нет подписок: тихо ничего не делает', async () => {
    await expect(enqueueToMember(pool, fam.sis.id, message)).resolves.toBeUndefined()
    expect(await sentTo([`https://push.test/${fam.sis.id}`])).toEqual([])
  })

  it('ошибка базы не пробрасывается: основное действие не ломается', async () => {
    const broken = { query: async () => { throw new Error('db down') } } as unknown as typeof pool
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(enqueueToMember(broken, fam.mom.id, message)).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('notify failed', 'db down')
    log.mockRestore()
  })
})

describe('очередь', () => {
  // payload читает сервис notifier: тот же образец (contracts/outbox-v1.json) проверяет notifier/tests/unit/contract.test.ts
  const emailPayload = sample.email
  const rowFor = async (match: string) =>
    (await pool.query(`select * from outbox where payload::text like $1 order by id desc limit 1`, [`%${match}%`])).rows[0]

  it('письмо: строка в очереди', async () => {
    await enqueue(pool, { channel: 'email', priority: PRIORITY.code, payload: emailPayload as never })

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
    await enqueue(pool, { channel: 'push', priority: PRIORITY.planned, payload: { v: 1, subscriptionId: id, message } })

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

  describe('склейка по tag', () => {
    const pushTo = async (subscription: string, tag: string, body = 'Текст') =>
      enqueue(pool, { channel: 'push', priority: PRIORITY.event, payload: { v: 1, subscriptionId: subscription, message: { ...message, tag, body } } })
    const bodiesFor = async (subscription: string, tag: string) =>
      (await pool.query(
        `select payload->'message'->>'body' as body from outbox where payload->>'subscriptionId' = $1 and payload->'message'->>'tag' = $2 order by id`,
        [subscription, tag],
      )).rows.map((r) => r.body)
    const cleanup = (...subs: string[]) => pool.query(`delete from outbox where payload->>'subscriptionId' = any($1)`, [subs])

    it('непосланное сообщение с тем же tag для той же подписки заменяется новым', async () => {
      const sub = await subscriptionId(await subscribe(fam.mom.id))
      await pushTo(sub, 'chat-family', 'первое')
      await pushTo(sub, 'chat-family', 'второе')
      await pushTo(sub, 'chat-family', 'третье')
      expect(await bodiesFor(sub, 'chat-family')).toEqual(['третье'])
      await cleanup(sub)
    })

    it('другой tag или другая подписка не затрагиваются', async () => {
      const mom = await subscriptionId(await subscribe(fam.mom.id))
      const dad = await subscriptionId(await subscribe(fam.dad.id))
      await pushTo(mom, 'chat-family', 'маме в чат')
      await pushTo(mom, 'task-1', 'маме задание')
      await pushTo(dad, 'chat-family', 'папе в чат')
      await pushTo(mom, 'chat-family', 'маме в чат, новое')
      expect(await bodiesFor(mom, 'chat-family')).toEqual(['маме в чат, новое'])
      expect(await bodiesFor(mom, 'task-1')).toEqual(['маме задание'])
      expect(await bodiesFor(dad, 'chat-family')).toEqual(['папе в чат'])
      await cleanup(mom, dad)
    })

    it('строка, которую notifier уже взял в работу (attempts > 0), остаётся: заменять поздно', async () => {
      const sub = await subscriptionId(await subscribe(fam.mom.id))
      await pushTo(sub, 'chat-family', 'в работе')
      await pool.query(`update outbox set attempts = 1 where payload->>'subscriptionId' = $1`, [sub])
      await pushTo(sub, 'chat-family', 'новое')
      expect(await bodiesFor(sub, 'chat-family')).toEqual(['в работе', 'новое'])
      await cleanup(sub)
    })

    it('гонка с notifier: замена, начатая в момент взятия строки в работу, её не удаляет', async () => {
      const sub = await subscriptionId(await subscribe(fam.mom.id))
      await pushTo(sub, 'chat-family', 'старое')
      const taker = await pool.connect()
      try {
        // notifier взял строку (attempts стал 1), но ещё не зафиксировал
        await taker.query('begin')
        await taker.query(`update outbox set attempts = attempts + 1 where payload->>'subscriptionId' = $1`, [sub])
        // замена ждёт блокировку строки
        const replacing = pushTo(sub, 'chat-family', 'новое')
        await new Promise((r) => setTimeout(r, 300))
        await taker.query('commit')
        await replacing
      } finally {
        taker.release()
      }
      // после фиксации строка уже «в работе», и её нельзя заменять: остались обе
      expect(await bodiesFor(sub, 'chat-family')).toEqual(['старое', 'новое'])
      await cleanup(sub)
    })

    it('письма не склеиваются: два кода на один адрес остаются оба', async () => {
      const send = (code: string) =>
        enqueue(pool, { channel: 'email', priority: PRIORITY.code, payload: { ...emailPayload, to: 'twice@test.local', code } as never })
      await send('111111')
      await send('222222')
      const rows = (await pool.query(`select payload->>'code' as code from outbox where payload->>'to' = 'twice@test.local' order by id`)).rows
      expect(rows.map((r) => r.code)).toEqual(['111111', '222222'])
      await pool.query(`delete from outbox where payload->>'to' = 'twice@test.local'`)
    })
  })

  it('будит notifier: сигнал outbox с id строки приходит после вставки', async () => {
    const listener = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await listener.connect()
    try {
      await listener.query('listen outbox')
      // таблица общая с параллельными файлами тестов: их вставки тоже шлют сигнал, поэтому копим все и ищем свой
      const seen: string[] = []
      listener.on('notification', (n) => seen.push(n.payload ?? ''))
      await enqueue(pool, { channel: 'email', priority: PRIORITY.code, payload: { ...emailPayload, to: 'notify@test.local' } as never })
      const row = await rowFor('notify@test.local')
      const deadline = Date.now() + 3000
      while (!seen.includes(String(row.id)) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20))
      expect(seen).toContain(String(row.id))
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
