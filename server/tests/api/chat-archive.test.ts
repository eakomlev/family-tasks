import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let outsider: TestFamily
let endpoints: Record<'mom' | 'dad' | 'kid', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  outsider = await createFamily()
  endpoints = { mom: await subscribe(fam.mom.id), dad: await subscribe(fam.dad.id), kid: await subscribe(fam.kid.id) }
})
beforeEach(async () => {
  await resetSent()
  await pool.query('delete from chat_archives where member_id = any($1)', [[fam.mom.id, fam.dad.id, fam.kid.id]])
})
afterAll(async () => {
  await removeFamilies(fam.id, outsider.id)
  await app.close()
  await pool.end()
})

const archive = (token: string, chat: string, archived: boolean) => api(app, token, 'PUT', `/api/chats/${chat}/archive`, { archived })
const list = async (token: string) => (await api(app, token, 'GET', '/api/chats')).body.chats as { id: string; archived: boolean; unread: number }[]
const send = (token: string, chat: string, text: string) => api(app, token, 'POST', `/api/chats/${chat}/messages`, { text })

describe('архив чатов', () => {
  it('по умолчанию чаты не в архиве; архив только у того, кто его поставил', async () => {
    expect((await list(fam.mom.token)).every((c) => c.archived === false)).toBe(true)

    expect((await archive(fam.mom.token, 'family', true)).status).toBe(204)
    expect((await list(fam.mom.token)).find((c) => c.id === 'family')!.archived).toBe(true)
    // у других участников чат остался в списке
    expect((await list(fam.dad.token)).find((c) => c.id === 'family')!.archived).toBe(false)
  })

  it('личный чат: архив у одного из собеседников', async () => {
    await archive(fam.mom.token, fam.kid.id, true)
    expect((await list(fam.mom.token)).find((c) => c.id === fam.kid.id)!.archived).toBe(true)
    // у ребёнка этот же чат называется по маме и не в архиве
    expect((await list(fam.kid.token)).find((c) => c.id === fam.mom.id)!.archived).toBe(false)
  })

  it('в архивный чат можно писать, сообщения приходят и уведомления идут', async () => {
    await archive(fam.kid.token, fam.mom.id, true)
    expect((await send(fam.mom.token, fam.kid.id, 'Привет')).status).toBe(201)
    expect((await send(fam.kid.token, fam.mom.id, 'Ответ')).status).toBe(201)

    const mine = (await list(fam.kid.token)).find((c) => c.id === fam.mom.id)!
    expect(mine.archived).toBe(true)
    // чат остаётся в архиве, а не выходит из него от нового сообщения
    await send(fam.mom.token, fam.kid.id, 'Ещё')
    expect((await list(fam.kid.token)).find((c) => c.id === fam.mom.id)).toMatchObject({ archived: true, unread: 1 })
    await new Promise((r) => setTimeout(r, 500))
    // push одного чата склеиваются по tag: остаётся последний, но он поставлен в очередь
    const pushes = await sentTo([endpoints.kid])
    expect(pushes.at(-1)!.payload).toMatchObject({ body: 'Ещё', url: `/chat/${fam.mom.id}` })
  })

  it('возврат из архива', async () => {
    await archive(fam.mom.token, 'family', true)
    expect((await archive(fam.mom.token, 'family', false)).status).toBe(204)
    expect((await list(fam.mom.token)).find((c) => c.id === 'family')!.archived).toBe(false)
    // повтор безопасен
    expect((await archive(fam.mom.token, 'family', false)).status).toBe(204)
  })

  it('чат события тоже архивируется; чужой чат нельзя', async () => {
    const created = await api(app, fam.mom.token, 'POST', '/api/events', { title: 'Театр', startDate: '2026-11-07', endDate: '2026-11-07', allFamily: false, memberIds: [fam.kid.id] })
    const chat = `event-${created.body.event.id}`
    await send(fam.mom.token, chat, 'Привет')

    expect((await archive(fam.mom.token, chat, true)).status).toBe(204)
    expect((await list(fam.mom.token)).find((c) => c.id === chat)!.archived).toBe(true)
    expect((await list(fam.kid.token)).find((c) => c.id === chat)!.archived).toBe(false)
    // папа не участник события
    expect((await archive(fam.dad.token, chat, true)).status).toBe(404)
    // чужая семья и несуществующий собеседник
    expect((await archive(outsider.mom.token, 'family', true)).status).toBe(204)
    expect((await archive(outsider.mom.token, fam.kid.id, true)).status).toBe(404)
  })

  it('неверное тело: 400', async () => {
    expect((await api(app, fam.mom.token, 'PUT', '/api/chats/family/archive', {})).status).toBe(400)
  })
})
