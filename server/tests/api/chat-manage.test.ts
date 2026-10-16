import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import type { MediaClient } from '../../src/media/client.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

// Замена сервиса media: помнит удалённые файлы.
class FakeMedia implements MediaClient {
  deleted: string[] = []
  failWith: Error | null = null
  async upload() {
    return { width: 100, height: 100, size: 1000, thumbSize: 100 }
  }
  async uploadFile(_family: string, _id: string, body: Buffer) {
    return { size: body.length }
  }
  async delete(_family: string, id: string) {
    if (this.failWith) throw this.failWith
    this.deleted.push(id)
  }
  async health() {
    return true
  }
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

let fam: TestFamily
let other: TestFamily
let app: Awaited<ReturnType<typeof buildApp>>
const fake = new FakeMedia()
let endpoints: Record<'mom' | 'dad' | 'kid', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false, media: { client: fake, secret: 'test-media-secret' } })
  await app.ready()
  fam = await createFamily()
  other = await createFamily()
  endpoints = { mom: await subscribe(fam.mom.id), dad: await subscribe(fam.dad.id), kid: await subscribe(fam.kid.id) }
})
beforeEach(async () => {
  await resetSent()
  fake.deleted = []
  fake.failWith = null
  await pool.query('delete from messages where family_id = $1', [fam.id])
  await pool.query('delete from chat_mutes where member_id = any($1)', [[fam.mom.id, fam.dad.id, fam.kid.id, fam.sis.id]])
})
afterAll(async () => {
  await removeFamilies(fam.id, other.id)
  await app.close()
  await pool.end()
})

const send = (token: string, chat: string, body: object) => api(app, token, 'POST', `/api/chats/${chat}/messages`, body)
const texts = async (token: string, chat: string) =>
  ((await api(app, token, 'GET', `/api/chats/${chat}/messages`)).body.messages as { text: string }[]).map((m) => m.text)
const clear = (token: string | null, chat: string) => api(app, token, 'DELETE', `/api/chats/${chat}/messages`)
const mute = (token: string, chat: string, muted: boolean) => api(app, token, 'PUT', `/api/chats/${chat}/mute`, { muted })
const listed = async (token: string) => (await api(app, token, 'GET', '/api/chats')).body.chats as { id: string; muted: boolean }[]
const pushes = async (...who: (keyof typeof endpoints)[]) => {
  await new Promise((r) => setTimeout(r, 150))
  return sentTo(who.map((w) => endpoints[w]))
}
const uploadPhoto = async (token: string, chat: string) => {
  const res = await app.inject({
    method: 'POST',
    url: `/api/chats/${chat}/media`,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    payload: JPEG,
  })
  return res.json().mediaId as string
}

describe('очистка чата', () => {
  it('родитель очищает общий чат: сообщения пропадают у всех, фото удаляются из хранилища', async () => {
    const mediaId = await uploadPhoto(fam.kid.token, 'family')
    await send(fam.kid.token, 'family', { text: 'привет', mediaIds: [mediaId] })
    await send(fam.mom.token, 'family', { text: 'ответ' })
    expect(await texts(fam.kid.token, 'family')).toHaveLength(2)

    expect((await clear(fam.mom.token, 'family')).status).toBe(204)
    expect(await texts(fam.kid.token, 'family')).toEqual([])
    expect(await texts(fam.dad.token, 'family')).toEqual([])
    expect(fake.deleted).toEqual([mediaId])
    const { rows } = await pool.query('select 1 from media where id = $1', [mediaId])
    expect(rows).toHaveLength(0)
  })

  it('очищает личный чат родителя с ребёнком, остальные чаты не трогает', async () => {
    await send(fam.mom.token, fam.kid.id, { text: 'личное' })
    await send(fam.mom.token, fam.sis.id, { text: 'другой личный' })
    await send(fam.mom.token, 'family', { text: 'общий' })

    // папа очищает свой личный чат с ребёнком, чат мамы остаётся
    expect((await clear(fam.dad.token, fam.kid.id)).status).toBe(204)
    expect(await texts(fam.mom.token, fam.kid.id)).toEqual(['личное'])

    expect((await clear(fam.mom.token, fam.kid.id)).status).toBe(204)
    expect(await texts(fam.kid.token, fam.mom.id)).toEqual([])
    expect(await texts(fam.mom.token, fam.sis.id)).toEqual(['другой личный'])
    expect(await texts(fam.mom.token, 'family')).toEqual(['общий'])
  })

  it('ребёнку нельзя: 403, сообщения на месте', async () => {
    await send(fam.kid.token, 'family', { text: 'моё' })
    expect((await clear(fam.kid.token, 'family')).status).toBe(403)
    expect((await clear(fam.kid.token, fam.mom.id)).status).toBe(403)
    expect(await texts(fam.mom.token, 'family')).toEqual(['моё'])
  })

  it('переписка двух детей родителю недоступна, чужая семья даёт 404', async () => {
    await send(fam.kid.token, fam.sis.id, { text: 'секрет' })
    // «чат с сестрой» у родителя это его собственный личный чат, а не переписка детей
    expect((await clear(fam.mom.token, fam.sis.id)).status).toBe(204)
    expect(await texts(fam.kid.token, fam.sis.id)).toEqual(['секрет'])
    expect((await clear(fam.mom.token, other.kid.id)).status).toBe(404)
  })

  it('без токена 401; повторная очистка пустого чата безопасна', async () => {
    expect((await clear(null, 'family')).status).toBe(401)
    expect((await clear(fam.mom.token, 'family')).status).toBe(204)
    expect((await clear(fam.mom.token, 'family')).status).toBe(204)
  })

  it('недоступное хранилище не мешает очистке: сообщения и запись о файле удалены', async () => {
    const mediaId = await uploadPhoto(fam.kid.token, 'family')
    await send(fam.kid.token, 'family', { mediaIds: [mediaId] })
    fake.failWith = new Error('down')
    expect((await clear(fam.mom.token, 'family')).status).toBe(204)
    expect(await texts(fam.mom.token, 'family')).toEqual([])
  })
})

describe('уведомления чата', () => {
  it('отключение действует только для себя и видно в списке чатов', async () => {
    expect((await mute(fam.kid.token, 'family', true)).status).toBe(204)
    expect((await listed(fam.kid.token)).find((c) => c.id === 'family')?.muted).toBe(true)
    expect((await listed(fam.mom.token)).find((c) => c.id === 'family')?.muted).toBe(false)
    // личный чат со своим ключом, общий не затронут
    expect((await listed(fam.kid.token)).find((c) => c.id === fam.mom.id)?.muted).toBe(false)
  })

  it('push в общем чате не приходит тому, кто отключил, остальным приходит', async () => {
    await mute(fam.kid.token, 'family', true)
    await send(fam.mom.token, 'family', { text: 'всем привет' })
    expect(await pushes('kid')).toHaveLength(0)
    expect(await pushes('dad')).toHaveLength(1)
  })

  it('в личном чате отключает получатель, а не автор', async () => {
    await mute(fam.kid.token, fam.mom.id, true)
    await send(fam.mom.token, fam.kid.id, { text: 'лично' })
    expect(await pushes('kid')).toHaveLength(0)
    await send(fam.kid.token, fam.mom.id, { text: 'ответ' })
    expect(await pushes('mom')).toHaveLength(1)
  })

  it('включение возвращает уведомления, повторное отключение не падает', async () => {
    expect((await mute(fam.kid.token, 'family', true)).status).toBe(204)
    expect((await mute(fam.kid.token, 'family', true)).status).toBe(204)
    expect((await mute(fam.kid.token, 'family', false)).status).toBe(204)
    await send(fam.mom.token, 'family', { text: 'снова' })
    expect(await pushes('kid')).toHaveLength(1)
  })

  it('чужой чат, неверное тело и отсутствие токена отвергаются', async () => {
    expect((await mute(fam.kid.token, other.kid.id, true)).status).toBe(404)
    expect((await api(app, fam.kid.token, 'PUT', '/api/chats/family/mute', {})).status).toBe(400)
    expect((await api(app, null, 'PUT', '/api/chats/family/mute', { muted: true })).status).toBe(401)
  })
})
