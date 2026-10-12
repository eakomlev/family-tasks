import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({ statusCode: 201 })) },
}))

import { buildApp } from '../../src/app.js'
import { REACTIONS } from '../../src/chat.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { sendNotification, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let outsider: TestFamily
let kidEndpoint: string

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  fam = await createFamily()
  outsider = await createFamily()
  await pool.query(`update members set name = 'Лена' where id = $1`, [fam.mom.id])
  kidEndpoint = await subscribe(fam.kid.id)
})
beforeEach(() => {
  sendNotification.mockClear()
})
afterAll(async () => {
  await removeFamilies(fam.id, outsider.id)
  await app.close()
  await pool.end()
})

const send = async (token: string, chat: string, text: string) => (await api(app, token, 'POST', `/api/chats/${chat}/messages`, { text })).body.message
const feedback = (token: string, chat: string, messageId: string, body: object) =>
  api(app, token, 'POST', `/api/chats/${chat}/messages/${messageId}/feedback`, body)
const messageOf = async (token: string, chat: string, id: string) =>
  ((await api(app, token, 'GET', `/api/chats/${chat}/messages`)).body.messages as any[]).find((m) => m.id === id)
const balance = async () => (await api(app, fam.kid.token, 'GET', '/api/me')).body.member.coins as number
const kidPushes = async () => {
  await new Promise((r) => setTimeout(r, 150))
  return sentTo([kidEndpoint]).map((s) => s.payload)
}

describe('реакции на сообщения детей', () => {
  it('родитель ставит реакцию: её видят все в чате, у нового сообщения реакций и монет нет', async () => {
    const msg = await send(fam.kid.token, 'family', 'Получил пятёрку!')
    expect(msg.reactions).toEqual([])
    expect(msg.awards).toEqual([])

    const res = await feedback(fam.mom.token, 'family', msg.id, { emoji: '👏' })
    expect(res.status).toBe(200)
    expect(res.body.message.reactions).toEqual([{ memberId: fam.mom.id, emoji: '👏' }])
    for (const viewer of [fam.kid, fam.dad, fam.sis]) {
      expect((await messageOf(viewer.token, 'family', msg.id)).reactions).toEqual([{ memberId: fam.mom.id, emoji: '👏' }])
    }
  })

  it('у родителя одна реакция на сообщение: новая заменяет прежнюю, null снимает, у двух родителей две', async () => {
    const msg = await send(fam.kid.token, 'family', 'Смотрите!')
    await feedback(fam.mom.token, 'family', msg.id, { emoji: '👍' })
    await feedback(fam.mom.token, 'family', msg.id, { emoji: '🔥' })
    await feedback(fam.dad.token, 'family', msg.id, { emoji: '❤️' })
    let reactions = (await messageOf(fam.kid.token, 'family', msg.id)).reactions
    expect(reactions).toHaveLength(2)
    expect(reactions).toEqual(expect.arrayContaining([{ memberId: fam.mom.id, emoji: '🔥' }, { memberId: fam.dad.id, emoji: '❤️' }]))

    await feedback(fam.mom.token, 'family', msg.id, { emoji: null })
    reactions = (await messageOf(fam.kid.token, 'family', msg.id)).reactions
    expect(reactions).toEqual([{ memberId: fam.dad.id, emoji: '❤️' }])
  })

  it('только реакция: монеты не начисляются и уведомления ребёнку нет', async () => {
    const msg = await send(fam.kid.token, 'family', 'без монет')
    const before = await balance()
    sendNotification.mockClear()
    await feedback(fam.mom.token, 'family', msg.id, { emoji: '🎉' })
    expect(await balance()).toBe(before)
    expect(await kidPushes()).toEqual([])
  })

  it('допустимы только реакции из списка', async () => {
    const msg = await send(fam.kid.token, 'family', 'x')
    for (const emoji of ['💩', 'a', '👍👍']) expect((await feedback(fam.mom.token, 'family', msg.id, { emoji })).status).toBe(400)
    for (const emoji of REACTIONS) expect((await feedback(fam.mom.token, 'family', msg.id, { emoji })).status).toBe(200)
  })
})

describe('монеты за сообщение', () => {
  it('родитель начисляет монеты: баланс растёт, в истории причина с началом сообщения и автор, под сообщением начисление', async () => {
    const msg = await send(fam.kid.token, 'family', 'Сдал контрольную по математике')
    const before = await balance()
    const res = await feedback(fam.mom.token, 'family', msg.id, { coins: 20 })
    expect(res.status).toBe(200)
    expect(res.body.message.awards).toEqual([{ amount: 20, by: fam.mom.id }])
    expect(await balance()).toBe(before + 20)

    const { body } = await api(app, fam.kid.token, 'GET', '/api/coins')
    expect(body.items[0]).toMatchObject({ amount: 20, reason: 'За сообщение: Сдал контрольную по математике', createdBy: fam.mom.id })
    const row = (await pool.query('select message_id as "messageId" from coin_transactions where member_id = $1 order by created_at desc, id desc limit 1', [fam.kid.id])).rows[0]
    expect(row.messageId).toBe(msg.id)
    expect((await messageOf(fam.sis.token, 'family', msg.id)).awards).toEqual([{ amount: 20, by: fam.mom.id }])
  })

  it('можно начислять несколько раз и разным родителям: каждое начисление отдельной записью', async () => {
    const msg = await send(fam.kid.token, 'family', 'Молодец?')
    const before = await balance()
    await feedback(fam.mom.token, 'family', msg.id, { coins: 10 })
    await feedback(fam.dad.token, 'family', msg.id, { coins: 5 })
    await feedback(fam.mom.token, 'family', msg.id, { coins: 7 })
    expect(await balance()).toBe(before + 22)
    const awards = (await messageOf(fam.kid.token, 'family', msg.id)).awards
    expect(awards.map((a: { amount: number }) => a.amount)).toEqual([10, 5, 7])
  })

  it('реакция и монеты вместе одним запросом', async () => {
    const msg = await send(fam.kid.token, 'family', 'Всё сразу')
    const before = await balance()
    const res = await feedback(fam.mom.token, 'family', msg.id, { emoji: '💪', coins: 30 })
    expect(res.body.message.reactions).toEqual([{ memberId: fam.mom.id, emoji: '💪' }])
    expect(res.body.message.awards).toEqual([{ amount: 30, by: fam.mom.id }])
    expect(await balance()).toBe(before + 30)
  })

  it('границы суммы: от 1 до 1000 целым числом', async () => {
    const msg = await send(fam.kid.token, 'family', 'суммы')
    for (const coins of [0, -5, 1001, 2.5]) expect((await feedback(fam.mom.token, 'family', msg.id, { coins })).status).toBe(400)
    expect((await feedback(fam.mom.token, 'family', msg.id, { coins: 1 })).status).toBe(200)
    expect((await feedback(fam.mom.token, 'family', msg.id, { coins: 1000 })).status).toBe(200)
  })

  it('пустой запрос отклоняется', async () => {
    const msg = await send(fam.kid.token, 'family', 'пусто')
    expect((await feedback(fam.mom.token, 'family', msg.id, {})).status).toBe(400)
  })

  it('ребёнку приходит уведомление о начислении: от «Мамы», сколько, за что, с реакцией', async () => {
    const msg = await send(fam.kid.token, 'family', 'уведомление')
    sendNotification.mockClear()
    await feedback(fam.mom.token, 'family', msg.id, { coins: 20 })
    expect(await kidPushes()).toEqual([
      { title: 'Мама', body: '+20 монет за ваше сообщение', url: '/chat/family', tag: `award-${msg.id}` },
    ])

    sendNotification.mockClear()
    await feedback(fam.dad.token, 'family', msg.id, { coins: 5, emoji: '👍' })
    const [push] = await kidPushes()
    expect(push.title).toBe('Папа')
    expect(push.body).toBe('+5 монет за ваше сообщение и реакция 👍')
  })

  it('в личном чате ссылка в уведомлении ведёт в чат с родителем', async () => {
    const msg = await send(fam.kid.token, fam.mom.id, 'мам, смотри')
    sendNotification.mockClear()
    await feedback(fam.mom.token, fam.kid.id, msg.id, { coins: 10 })
    const [push] = await kidPushes()
    expect(push.url).toBe(`/chat/${fam.mom.id}`)
  })
})

describe('кто может и на что', () => {
  it('ребёнок не может начислять монеты (и себе тоже), даже вместе с реакцией', async () => {
    const msg = await send(fam.kid.token, 'family', 'сам себе')
    for (const token of [fam.kid.token, fam.sis.token]) {
      const res = await feedback(token, 'family', msg.id, { coins: 100, emoji: '👍' })
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('parents_only')
    }
    const after = await messageOf(fam.mom.token, 'family', msg.id)
    expect(after.awards).toEqual([])
    expect(after.reactions).toEqual([])
  })

  it('реакцию ставит любой участник чата и на любое сообщение, в том числе ребёнок на сообщение родителя', async () => {
    const dadMsg = await send(fam.dad.token, 'family', 'от папы')
    expect((await feedback(fam.kid.token, 'family', dadMsg.id, { emoji: '❤️' })).status).toBe(200)
    expect((await feedback(fam.mom.token, 'family', dadMsg.id, { emoji: '👍' })).status).toBe(200)
    const reactions = (await messageOf(fam.mom.token, 'family', dadMsg.id)).reactions
    expect(reactions).toEqual(expect.arrayContaining([
      { memberId: fam.kid.id, emoji: '❤️' },
      { memberId: fam.mom.id, emoji: '👍' },
    ]))

    const sisMsg = await send(fam.sis.token, 'family', 'от сестры')
    expect((await feedback(fam.kid.token, 'family', sisMsg.id, { emoji: '🎉' })).status).toBe(200)
  })

  it('монеты только на сообщения детей: на сообщение взрослого нельзя', async () => {
    const msg = await send(fam.dad.token, 'family', 'от папы')
    const res = await feedback(fam.mom.token, 'family', msg.id, { coins: 10 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('not_a_child_message')
    // реакция на то же сообщение допустима
    expect((await feedback(fam.mom.token, 'family', msg.id, { emoji: '👍' })).status).toBe(200)
  })

  it('личная переписка двоих недоступна остальным: другой родитель не найдёт это сообщение', async () => {
    const msg = await send(fam.kid.token, fam.mom.id, 'только маме')
    // папа обращается к своему чату с ребёнком: сообщения там нет
    expect((await feedback(fam.dad.token, fam.kid.id, msg.id, { coins: 10 })).status).toBe(404)
    // а в общем чате этого сообщения тоже нет
    expect((await feedback(fam.dad.token, 'family', msg.id, { coins: 10 })).status).toBe(404)
  })

  it('переписка двух детей родителям недоступна', async () => {
    const msg = await send(fam.kid.token, fam.sis.id, 'между нами')
    expect((await feedback(fam.mom.token, fam.sis.id, msg.id, { coins: 10 })).status).toBe(404)
    expect((await feedback(fam.mom.token, 'family', msg.id, { coins: 10 })).status).toBe(404)
  })

  it('чужая семья и неизвестное сообщение', async () => {
    const msg = await send(fam.kid.token, 'family', 'наше')
    expect((await feedback(outsider.mom.token, 'family', msg.id, { coins: 10 })).status).toBe(404)
    expect((await feedback(fam.mom.token, 'family', '00000000-0000-4000-8000-000000000000', { coins: 10 })).status).toBe(404)
    expect((await api(app, null, 'POST', `/api/chats/family/messages/${msg.id}/feedback`, { coins: 1 })).status).toBe(401)
  })

  it('начисление не меняет баланс чужого ребёнка', async () => {
    const msg = await send(fam.kid.token, 'family', 'только мне')
    const sisBefore = (await api(app, fam.sis.token, 'GET', '/api/me')).body.member.coins
    await feedback(fam.mom.token, 'family', msg.id, { coins: 50 })
    expect((await api(app, fam.sis.token, 'GET', '/api/me')).body.member.coins).toBe(sisBefore)
  })

  it('удаление сообщения (через семью) убирает реакции, а монеты остаются у ребёнка без привязки', async () => {
    const f = await createFamily()
    try {
      const m = (await api(app, f.kid.token, 'POST', '/api/chats/family/messages', { text: 'удалим' })).body.message
      await api(app, f.mom.token, 'POST', `/api/chats/family/messages/${m.id}/feedback`, { emoji: '👍', coins: 15 })
      await pool.query('delete from messages where id = $1', [m.id])
      expect((await pool.query('select 1 from message_reactions where message_id = $1', [m.id])).rowCount).toBe(0)
      expect((await api(app, f.kid.token, 'GET', '/api/me')).body.member.coins).toBe(15)
      expect((await pool.query('select message_id from coin_transactions where member_id = $1', [f.kid.id])).rows[0].message_id).toBeNull()
    } finally {
      await removeFamilies(f.id)
    }
  })
})
