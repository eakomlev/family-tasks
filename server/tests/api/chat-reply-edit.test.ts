import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const send = (token: string, text: string, extra: object = {}) => api(app, token, 'POST', '/api/chats/family/messages', { text, ...extra })
const list = async (token: string) => (await api(app, token, 'GET', '/api/chats/family/messages')).body.messages as any[]

describe('ответ на сообщение', () => {
  it('сохраняет выдержку исходного, а после его удаления остаётся без цитаты', async () => {
    const original = (await send(fam.mom.token, 'Кто сегодня за хлебом?')).body.message
    const answer = await send(fam.kid.token, 'Я схожу', { replyTo: original.id })
    expect(answer.status).toBe(201)
    expect(answer.body.message.replyTo).toEqual({ id: original.id, senderId: fam.mom.id, text: 'Кто сегодня за хлебом?' })

    expect((await list(fam.dad.token)).find((m) => m.id === answer.body.message.id).replyTo.id).toBe(original.id)

    expect((await api(app, fam.mom.token, 'DELETE', `/api/chats/family/messages/${original.id}`)).status).toBe(204)
    expect((await list(fam.dad.token)).find((m) => m.id === answer.body.message.id).replyTo).toBeNull()
  })

  it('на сообщение из другого чата ответить нельзя', async () => {
    const other = (await api(app, fam.mom.token, 'POST', `/api/chats/${fam.kid.id}/messages`, { text: 'личное' })).body.message
    const res = await send(fam.dad.token, 'ответ', { replyTo: other.id })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_reply')
  })
})

describe('правка и удаление', () => {
  it('автор правит текст, появляется отметка editedAt', async () => {
    const msg = (await send(fam.kid.token, 'Опечатка')).body.message
    expect(msg.editedAt).toBeNull()
    const res = await api(app, fam.kid.token, 'PATCH', `/api/chats/family/messages/${msg.id}`, { text: '  Исправлено ' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatchObject({ text: 'Исправлено', caption: 'Исправлено' })
    expect(res.body.message.editedAt).not.toBeNull()
    expect((await list(fam.mom.token)).find((m) => m.id === msg.id).text).toBe('Исправлено')
  })

  it('чужое сообщение править и удалять нельзя, даже родителю', async () => {
    const msg = (await send(fam.kid.token, 'Моё')).body.message
    expect((await api(app, fam.mom.token, 'PATCH', `/api/chats/family/messages/${msg.id}`, { text: 'x' })).status).toBe(403)
    expect((await api(app, fam.mom.token, 'DELETE', `/api/chats/family/messages/${msg.id}`)).status).toBe(403)
    expect((await list(fam.kid.token)).some((m) => m.id === msg.id)).toBe(true)
  })

  it('пустой текст отклоняется, несуществующее сообщение 404', async () => {
    const msg = (await send(fam.kid.token, 'Текст')).body.message
    expect((await api(app, fam.kid.token, 'PATCH', `/api/chats/family/messages/${msg.id}`, { text: '   ' })).status).toBe(400)
    const missing = '00000000-0000-4000-8000-000000000000'
    expect((await api(app, fam.kid.token, 'DELETE', `/api/chats/family/messages/${missing}`)).status).toBe(404)
  })

  it('удаление убирает сообщение у всех', async () => {
    const msg = (await send(fam.kid.token, 'Лишнее')).body.message
    expect((await api(app, fam.kid.token, 'DELETE', `/api/chats/family/messages/${msg.id}`)).status).toBe(204)
    expect((await list(fam.mom.token)).some((m) => m.id === msg.id)).toBe(false)
  })
})
