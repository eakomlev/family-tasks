import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let outsider: TestFamily
let endpoints: Record<'mom' | 'dad' | 'kid' | 'sis', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  outsider = await createFamily()
  endpoints = {
    mom: await subscribe(fam.mom.id),
    dad: await subscribe(fam.dad.id),
    kid: await subscribe(fam.kid.id),
    sis: await subscribe(fam.sis.id),
  }
})
beforeEach(async () => {
  await resetSent()
})
afterAll(async () => {
  await removeFamilies(fam.id, outsider.id)
  await app.close()
  await pool.end()
})

const makeEvent = async (token: string, over: object = {}) => {
  const res = await api(app, token, 'POST', '/api/events', {
    title: 'Поход в театр',
    startDate: '2026-11-07',
    endDate: '2026-11-07',
    startTime: '18:00',
    endTime: '20:30',
    allFamily: false,
    memberIds: [],
    ...over,
  })
  expect(res.status).toBe(201)
  return res.body.event.id as string
}
const chatOf = (eventId: string) => `event-${eventId}`
const send = (token: string, chat: string, text: string) => api(app, token, 'POST', `/api/chats/${chat}/messages`, { text })
const messages = (token: string, chat: string) => api(app, token, 'GET', `/api/chats/${chat}/messages`)
const list = async (token: string) => (await api(app, token, 'GET', '/api/chats')).body.chats as { id: string; last: any; unread: number; event: { id: string; title: string } | null }[]
const pushes = async (...who: (keyof typeof endpoints)[]) => {
  return sentTo(who.map((w) => endpoints[w]))
}

describe('доступ к чату события', () => {
  it('автор и участник читают и пишут, остальные получают 404', async () => {
    const id = await makeEvent(fam.mom.token, { memberIds: [fam.kid.id] })
    const chat = chatOf(id)

    expect((await send(fam.mom.token, chat, 'Берём билеты')).status).toBe(201)
    expect((await send(fam.kid.token, chat, 'Ура!')).status).toBe(201)
    const read = await messages(fam.kid.token, chat)
    expect(read.status).toBe(200)
    expect(read.body.messages.map((m: { text: string }) => m.text)).toEqual(['Берём билеты', 'Ура!'])
    // сообщения видны и автору события
    expect((await messages(fam.mom.token, chat)).body.messages).toHaveLength(2)

    // не участник семьи
    expect((await messages(fam.dad.token, chat)).status).toBe(404)
    expect((await send(fam.sis.token, chat, 'Можно мне?')).status).toBe(404)
    // чужая семья
    expect((await messages(outsider.mom.token, chat)).status).toBe(404)
  })

  it('событие для всей семьи: чат у всех', async () => {
    const id = await makeEvent(fam.dad.token, { allFamily: true })
    for (const who of [fam.mom, fam.dad, fam.kid, fam.sis]) expect((await send(who.token, chatOf(id), `от ${who.name}`)).status).toBe(201)
    expect((await messages(fam.sis.token, chatOf(id))).body.messages).toHaveLength(4)
  })

  it('несуществующее событие: 404', async () => {
    expect((await messages(fam.mom.token, 'event-00000000-0000-4000-8000-000000000000')).status).toBe(404)
  })

  it('убранный из события теряет доступ, добавленный получает', async () => {
    const id = await makeEvent(fam.mom.token, { memberIds: [fam.kid.id] })
    await send(fam.mom.token, chatOf(id), 'Привет')
    expect((await messages(fam.kid.token, chatOf(id))).status).toBe(200)

    const changed = await api(app, fam.mom.token, 'PUT', `/api/events/${id}`, {
      title: 'Поход в театр',
      startDate: '2026-11-07',
      endDate: '2026-11-07',
      memberIds: [fam.sis.id],
    })
    expect(changed.status).toBe(200)
    expect((await messages(fam.kid.token, chatOf(id))).status).toBe(404)
    expect((await messages(fam.sis.token, chatOf(id))).status).toBe(200)
  })
})

describe('список чатов', () => {
  it('чат события появляется после первого сообщения и только у участников', async () => {
    const id = await makeEvent(fam.mom.token, { title: 'Ночёвка у бабушки', memberIds: [fam.kid.id] })

    expect((await list(fam.mom.token)).some((c) => c.id === chatOf(id))).toBe(false)
    expect((await list(fam.kid.token)).some((c) => c.id === chatOf(id))).toBe(false)

    await send(fam.mom.token, chatOf(id), 'Собираем вещи')

    const mine = (await list(fam.mom.token)).find((c) => c.id === chatOf(id))
    expect(mine).toMatchObject({ unread: 0, event: { id, title: 'Ночёвка у бабушки' } })
    expect(mine!.last.text).toBe('Собираем вещи')
    const kids = (await list(fam.kid.token)).find((c) => c.id === chatOf(id))
    expect(kids).toMatchObject({ unread: 1, event: { id, title: 'Ночёвка у бабушки' } })
    // не участнику чат не виден
    expect((await list(fam.dad.token)).some((c) => c.id === chatOf(id))).toBe(false)
    // обычные чаты по-прежнему без поля события
    expect((await list(fam.kid.token)).find((c) => c.id === 'family')!.event).toBeNull()
  })

  it('прочтение сбрасывает счётчик и отмечает сообщения автора прочитанными', async () => {
    const id = await makeEvent(fam.mom.token, { memberIds: [fam.kid.id] })
    await send(fam.mom.token, chatOf(id), 'Читай')
    expect((await api(app, fam.kid.token, 'POST', `/api/chats/${chatOf(id)}/read`)).status).toBe(204)
    expect((await list(fam.kid.token)).find((c) => c.id === chatOf(id))!.unread).toBe(0)
    const seen = (await api(app, fam.mom.token, 'GET', '/api/chats')).body.chats.find((c: { id: string }) => c.id === chatOf(id))
    expect(new Date(seen.last.createdAt).getTime()).toBeLessThanOrEqual(new Date(seen.readUpTo).getTime())
  })
})

describe('уведомления', () => {
  it('приходят участникам, кроме автора, с названием события', async () => {
    const id = await makeEvent(fam.mom.token, { title: 'Театр', memberIds: [fam.kid.id, fam.dad.id] })
    await send(fam.mom.token, chatOf(id), 'Встречаемся в шесть')
    const got = await pushes('mom', 'dad', 'kid', 'sis')
    // получили папа и ребёнок, у автора и не участника пусто
    expect(got.map((p) => p.endpoint).sort()).toEqual([endpoints.dad, endpoints.kid].sort())
    for (const p of got) expect(p.payload).toMatchObject({ title: 'Мама · Театр', url: `/chat/${chatOf(id)}`, tag: `chat-${chatOf(id)}` })
  })

  it('отключённый чат молчит', async () => {
    const id = await makeEvent(fam.mom.token, { memberIds: [fam.kid.id] })
    expect((await api(app, fam.kid.token, 'PUT', `/api/chats/${chatOf(id)}/mute`, { muted: true })).status).toBe(204)
    await send(fam.mom.token, chatOf(id), 'Тихо')
    expect(await pushes('kid')).toHaveLength(0)
  })
})

describe('удаление события', () => {
  it('убирает чат вместе с сообщениями', async () => {
    const id = await makeEvent(fam.mom.token, { memberIds: [fam.kid.id] })
    await send(fam.mom.token, chatOf(id), 'Раз')
    await send(fam.kid.token, chatOf(id), 'Два')
    expect((await list(fam.kid.token)).some((c) => c.id === chatOf(id))).toBe(true)

    expect((await api(app, fam.mom.token, 'DELETE', `/api/events/${id}`)).status).toBe(204)

    expect((await messages(fam.kid.token, chatOf(id))).status).toBe(404)
    expect((await list(fam.kid.token)).some((c) => c.id === chatOf(id))).toBe(false)
    const { rows } = await pool.query("select 1 from messages where chat_key = $1", [`event:${id}`])
    expect(rows).toHaveLength(0)
  })
})
