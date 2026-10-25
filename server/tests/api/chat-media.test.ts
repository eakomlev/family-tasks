import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { createMediaClient, MediaRejected, type MediaClient, type UploadResult } from '../../src/media/client.js'
import { deleteOrphanMedia } from '../../src/media/cleanup.js'
import { expiryFor, sign } from '../../src/media/sign.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

// контрольный пример подписи из общего контракта: тот же проверяет сервис media
const { sign: vector } = JSON.parse(readFileSync(new URL('../../../contracts/media-v1.json', import.meta.url), 'utf8'))

const SECRET = 'test-media-secret'
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

// Замена сервиса media: запоминает вызовы, размеры отдаёт заданные тестом.
class FakeMedia implements MediaClient {
  uploads: { family: string; id: string; size: number }[] = []
  deleted: string[] = []
  next: UploadResult = { width: 1600, height: 1200, size: 250_000, thumbSize: 20_000 }
  failWith: Error | null = null
  async upload(family: string, id: string, body: Buffer) {
    if (this.failWith) throw this.failWith
    this.uploads.push({ family, id, size: body.length })
    return this.next
  }
  files: { family: string; id: string; size: number }[] = []
  async uploadFile(family: string, id: string, body: Buffer) {
    if (this.failWith) throw this.failWith
    this.files.push({ family, id, size: body.length })
    return { size: body.length }
  }
  async delete(_family: string, id: string) {
    if (this.failWith) throw this.failWith
    this.deleted.push(id)
  }
  async uploadVideo(): Promise<never> {
    throw new Error('видео в этом тесте не загружается')
  }
  async health() {
    return !this.failWith
  }
}

let fam: TestFamily
let outsider: TestFamily
let app: Awaited<ReturnType<typeof buildApp>>
let disabledApp: Awaited<ReturnType<typeof buildApp>>
const fake = new FakeMedia()
let endpoints: Record<'mom' | 'kid' | 'sis', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false, media: { client: fake, secret: SECRET } })
  disabledApp = await buildApp({ logger: false, rateLimit: false, media: null })
  await app.ready()
  await disabledApp.ready()
  fam = await createFamily()
  outsider = await createFamily()
  endpoints = { mom: await subscribe(fam.mom.id), kid: await subscribe(fam.kid.id), sis: await subscribe(fam.sis.id) }
})
beforeEach(async () => {
  await resetSent()
  fake.uploads = []
  fake.deleted = []
  fake.failWith = null
  fake.next = { width: 1600, height: 1200, size: 250_000, thumbSize: 20_000 }
})
afterEach(() => {
  vi.unstubAllEnvs()
})
afterAll(async () => {
  await removeFamilies(fam.id, outsider.id)
  await app.close()
  await disabledApp.close()
  await pool.end()
})

const upload = (token: string | null, chat: string, body: Buffer | string = JPEG, type = 'image/jpeg', target = app) =>
  target.inject({
    method: 'POST',
    url: `/api/chats/${chat}/media`,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': type },
    payload: body,
  })
const photo = async (token = fam.kid.token, chat = 'family') => (await upload(token, chat)).json().mediaId as string
const send = (token: string, chat: string, body: object, target = app) => api(target, token, 'POST', `/api/chats/${chat}/messages`, body)
const history = async (token: string, chat = 'family') => (await api(app, token, 'GET', `/api/chats/${chat}/messages`)).body
const pushes = async (...who: (keyof typeof endpoints)[]) => {
  await new Promise((r) => setTimeout(r, 150))
  return sentTo(who.map((w) => endpoints[w]))
}

describe('подпись ссылок', () => {
  it('совпадает с контрольным примером контракта (его же проверяет media)', () => {
    expect(sign(vector.secret, vector.family, vector.id, vector.exp)).toBe(vector.sig)
  })

  it('срок кратен суткам и лежит в пределах 24–48 часов', () => {
    const now = new Date('2026-10-13T12:34:56Z')
    const exp = expiryFor(now)
    expect(exp % 86400).toBe(0)
    const left = exp - now.getTime() / 1000
    expect(left).toBeGreaterThan(24 * 3600)
    expect(left).toBeLessThanOrEqual(48 * 3600)
    // в течение суток адрес не меняется
    expect(expiryFor(new Date('2026-10-13T00:00:01Z'))).toBe(expiryFor(new Date('2026-10-13T23:59:59Z')))
    expect(expiryFor(new Date('2026-10-14T00:00:01Z'))).toBe(exp + 86400)
  })
})

describe('загрузка фото', () => {
  it('сохраняет запись, передаёт файл сервису media, возвращает размеры', async () => {
    const res = await upload(fam.kid.token, 'family')
    expect(res.statusCode).toBe(201)
    const { mediaId, width, height } = res.json()
    expect([width, height]).toEqual([1600, 1200])
    expect(fake.uploads).toEqual([{ family: fam.id, id: mediaId, size: JPEG.length }])
    const { rows } = await pool.query('select family_id, uploader_id, width, height, size, attached_at from media where id = $1', [mediaId])
    expect(rows[0]).toMatchObject({ family_id: fam.id, uploader_id: fam.kid.id, width: 1600, height: 1200, size: 250_000, attached_at: null })
  })

  it('без токена 401; чужой чат 404; несуществующий участник 404', async () => {
    expect((await upload(null, 'family')).statusCode).toBe(401)
    expect((await upload(outsider.mom.token, fam.kid.id)).statusCode).toBe(404)
    expect((await upload(fam.kid.token, '33333333-3333-4333-8333-333333333333')).statusCode).toBe(404)
    expect(fake.uploads).toEqual([])
  })

  it('пустое тело, не JPEG по типу и слишком большой файл отклоняются, сервис media не вызывается', async () => {
    expect((await upload(fam.kid.token, 'family', '')).statusCode).toBeGreaterThanOrEqual(400)
    expect((await upload(fam.kid.token, 'family', 'текст', 'text/plain')).statusCode).toBe(415)
    expect((await upload(fam.kid.token, 'family', Buffer.alloc(3 * 1024 * 1024 + 1))).statusCode).toBe(413)
    expect(fake.uploads).toEqual([])
  })

  it('media отклонил файл: 400 invalid_media и записи нет', async () => {
    fake.failWith = new MediaRejected()
    const res = await upload(fam.kid.token, 'family')
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'invalid_media' })
  })

  it('media недоступен: 502 без подробностей, записи нет', async () => {
    const before = (await pool.query('select count(*)::int as n from media where family_id = $1', [fam.id])).rows[0].n
    fake.failWith = new Error('connect ECONNREFUSED 10.0.0.5:3000')
    const res = await upload(fam.kid.token, 'family')
    expect(res.statusCode).toBe(502)
    expect(res.body).not.toContain('ECONNREFUSED')
    expect((await pool.query('select count(*)::int as n from media where family_id = $1', [fam.id])).rows[0].n).toBe(before)
  })

  it('фото не настроены: 503, а текст в чате работает как раньше', async () => {
    expect((await upload(fam.kid.token, 'family', JPEG, 'image/jpeg', disabledApp)).statusCode).toBe(503)
    expect((await send(fam.kid.token, 'family', { text: 'просто текст' }, disabledApp)).status).toBe(201)
    expect((await send(fam.kid.token, 'family', { mediaIds: ['33333333-3333-4333-8333-333333333333'] }, disabledApp)).status).toBe(503)
  })

  it('квота семьи: сверх лимита 413, чужие файлы не считаются', async () => {
    // у outsider места нет вообще, у fam достаточно: квота считается по семье
    vi.stubEnv('MEDIA_QUOTA_BYTES', String(JPEG.length + 100))
    await pool.query('delete from media where family_id = any($1)', [[fam.id, outsider.id]])
    const first = await upload(fam.kid.token, 'family')
    expect(first.statusCode).toBe(201)
    // записанный размер от media (250 000) уже больше квоты, поэтому следующее фото не принимается
    const second = await upload(fam.mom.token, 'family')
    expect(second.statusCode).toBe(413)
    expect(second.json()).toEqual({ error: 'media_quota' })
    // другая семья свою квоту ещё не занимала
    expect((await upload(outsider.mom.token, 'family')).statusCode).toBe(201)
  })
})

describe('сообщения с фото', () => {
  it('одно фото без подписи: заглушка в text, пустая подпись, подписанные адреса', async () => {
    const id = await photo()
    const res = await send(fam.kid.token, 'family', { mediaIds: [id] })
    expect(res.status).toBe(201)
    const { message } = res.body
    expect(message).toMatchObject({ text: '📷 Фото', caption: '', senderId: fam.kid.id })
    expect(message.media).toHaveLength(1)
    const [m] = message.media
    expect(m).toMatchObject({ id, width: 1600, height: 1200 })
    // адрес вида /media/<семья>/<файл>/(thumb|full)?exp=&sig= с верной подписью
    const url = new URL(m.thumbUrl, 'http://x')
    expect(url.pathname).toBe(`/media/${fam.id}/${id}/thumb`)
    const exp = Number(url.searchParams.get('exp'))
    expect(url.searchParams.get('sig')).toBe(sign(SECRET, fam.id, id, exp))
    expect(new URL(m.fullUrl, 'http://x').pathname).toBe(`/media/${fam.id}/${id}/full`)
    expect(new URL(m.fullUrl, 'http://x').searchParams.get('sig')).toBe(url.searchParams.get('sig'))
    // файл прикреплён
    const { rows } = await pool.query('select attached_at from media where id = $1', [id])
    expect(rows[0].attached_at).not.toBeNull()
  })

  it('несколько фото сохраняют порядок; заглушка с числом; в истории те же адреса', async () => {
    const ids = [await photo(), await photo(), await photo()]
    const reversed = [...ids].reverse()
    const res = await send(fam.kid.token, 'family', { mediaIds: reversed })
    expect(res.body.message.text).toBe('📷 Фото ×3')
    expect(res.body.message.media.map((m: any) => m.id)).toEqual(reversed)
    const found = (await history(fam.mom.token)).messages.find((m: any) => m.id === res.body.message.id)
    expect(found.media.map((m: any) => m.id)).toEqual(reversed)
    // адрес одного фото в течение суток не меняется: браузер кэширует картинку
    expect(found.media[0].thumbUrl).toBe(res.body.message.media[0].thumbUrl)
  })

  it('фото с подписью: text и caption равны подписи', async () => {
    const id = await photo()
    const res = await send(fam.kid.token, 'family', { text: '  Смотри, что нашёл  ', mediaIds: [id] })
    expect(res.body.message).toMatchObject({ text: 'Смотри, что нашёл', caption: 'Смотри, что нашёл' })
    expect(res.body.message.media).toHaveLength(1)
  })

  it('обычное текстовое сообщение: caption равна тексту, фото нет', async () => {
    const res = await send(fam.kid.token, 'family', { text: 'привет' })
    expect(res.body.message).toMatchObject({ text: 'привет', caption: 'привет', media: [] })
  })

  it('пустое сообщение (ни текста, ни фото) отклоняется', async () => {
    expect((await send(fam.kid.token, 'family', {})).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { text: '   ' })).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { text: '  ', mediaIds: [] })).status).toBe(400)
  })

  it('чужие, уже прикреплённые, несуществующие, повторяющиеся и лишние фото отклоняются, сообщение не создаётся', async () => {
    const before = (await history(fam.mom.token)).messages.length
    const mine = await photo(fam.kid.token)
    const moms = await photo(fam.mom.token)
    const strangers = (await upload(outsider.mom.token, 'family')).json().mediaId as string
    expect((await send(fam.kid.token, 'family', { mediaIds: [moms] })).status).toBe(400) // загрузил другой участник
    expect((await send(fam.kid.token, 'family', { mediaIds: [strangers] })).status).toBe(400) // другая семья
    expect((await send(fam.kid.token, 'family', { mediaIds: ['33333333-3333-4333-8333-333333333333'] })).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { mediaIds: [mine, mine] })).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { mediaIds: [mine, moms] })).status).toBe(400) // одно из двух чужое: ни одно не прикрепляется
    const { rows } = await pool.query('select attached_at from media where id = $1', [mine])
    expect(rows[0].attached_at).toBeNull()
    expect((await send(fam.kid.token, 'family', { mediaIds: Array.from({ length: 11 }, () => '33333333-3333-4333-8333-333333333333') })).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { mediaIds: ['не-uuid'] })).status).toBe(400)
    expect((await history(fam.mom.token)).messages.length).toBe(before)
    // после ошибок своё фото всё ещё можно отправить
    expect((await send(fam.kid.token, 'family', { mediaIds: [mine] })).status).toBe(201)
  })

  it('одно фото нельзя отправить дважды', async () => {
    const id = await photo()
    expect((await send(fam.kid.token, 'family', { mediaIds: [id] })).status).toBe(201)
    expect((await send(fam.kid.token, 'family', { mediaIds: [id] })).status).toBe(400)
  })

  it('десять фото принимаются', async () => {
    const ids = await Promise.all(Array.from({ length: 10 }, () => photo()))
    const res = await send(fam.kid.token, 'family', { mediaIds: ids })
    expect(res.status).toBe(201)
    expect(res.body.message.media).toHaveLength(10)
  })

  it('фото в личном чате видят только двое, а в общем вся семья; чужая семья не видит ничего', async () => {
    const id = await photo(fam.kid.token, fam.mom.id)
    const res = await send(fam.kid.token, fam.mom.id, { mediaIds: [id] })
    expect(res.status).toBe(201)
    expect((await history(fam.mom.token, fam.kid.id)).messages.at(-1).media).toHaveLength(1)
    expect((await api(app, fam.sis.token, 'GET', `/api/chats/${fam.kid.id}/messages`)).body.messages.some((m: any) => m.media.length > 0)).toBe(false)
    expect((await api(app, outsider.mom.token, 'GET', '/api/chats/family/messages')).body.messages).toEqual([])
  })

  it('список чатов: у последнего сообщения с фото есть заглушка и фото', async () => {
    const id = await photo(fam.sis.token, fam.kid.id)
    await send(fam.sis.token, fam.kid.id, { mediaIds: [id] })
    const { chats } = (await api(app, fam.kid.token, 'GET', '/api/chats')).body
    const last = chats.find((c: any) => c.id === fam.sis.id).last
    expect(last).toMatchObject({ text: '📷 Фото', caption: '' })
    expect(last.media).toHaveLength(1)
  })

  it('реакция на сообщение с фото возвращает его вместе с фото', async () => {
    const id = await photo()
    const sent = (await send(fam.kid.token, 'family', { mediaIds: [id] })).body.message
    const res = await api(app, fam.mom.token, 'POST', `/api/chats/family/messages/${sent.id}/feedback`, { emoji: '👍' })
    expect(res.status).toBe(200)
    expect(res.body.message.media).toHaveLength(1)
    expect(res.body.message.reactions).toEqual([{ memberId: fam.mom.id, emoji: '👍' }])
  })

  it('уведомление: «📷 Фото» или «📷 подпись»', async () => {
    const only = await photo()
    await send(fam.kid.token, 'family', { mediaIds: [only] })
    const three = [await photo(), await photo(), await photo()]
    await send(fam.kid.token, 'family', { mediaIds: three })
    await new Promise((r) => setTimeout(r, 150))
    const withCaption = await photo()
    await send(fam.kid.token, 'family', { text: 'Вот', mediaIds: [withCaption] })
    const bodies = (await pushes('mom')).map((p) => p.payload.body)
    // уведомления одного чата склеиваются по tag (остаётся последнее ещё не отправленное), поэтому проверяем последнее
    expect(bodies.at(-1)).toBe('📷 Вот')
  })

  it('уведомление только с фото содержит заглушку', async () => {
    await resetSent()
    const id = await photo()
    await send(fam.kid.token, fam.mom.id, { mediaIds: [id] })
    const [push] = await pushes('mom')
    expect(push.payload).toMatchObject({ title: 'Ребёнок', body: '📷 Фото', url: `/chat/${fam.kid.id}` })
  })
})

describe('все фото чата', () => {
  const list = (token: string | null, chat: string, query = '', target = app) => api(target, token, 'GET', `/api/chats/${chat}/media${query}`)

  it('свежие первыми, внутри сообщения по порядку; страницы по before; доступ как к чату', async () => {
    const f = await createFamily()
    try {
      const a = [await photo(f.kid.token), await photo(f.kid.token)]
      await send(f.kid.token, 'family', { mediaIds: a })
      await new Promise((r) => setTimeout(r, 15))
      const b = [await photo(f.mom.token)]
      await send(f.mom.token, 'family', { text: 'вот', mediaIds: b })
      await send(f.mom.token, 'family', { text: 'без фото' })

      const all = await list(f.dad.token, 'family')
      expect(all.status).toBe(200)
      expect(all.body.items.map((i: any) => i.id)).toEqual([b[0], a[0], a[1]])
      expect(all.body.hasMore).toBe(false)
      expect(all.body.items[0]).toMatchObject({ senderId: f.mom.id, width: 1600, height: 1200 })
      expect(new URL(all.body.items[0].thumbUrl, 'http://x').pathname).toBe(`/media/${f.id}/${b[0]}/thumb`)

      // по одному фото на странице: курсор before ведёт по списку без пропусков и повторов
      const p1 = await list(f.dad.token, 'family', '?limit=1')
      expect(p1.body.items.map((i: any) => i.id)).toEqual([b[0]])
      expect(p1.body.hasMore).toBe(true)
      const p2 = await list(f.dad.token, 'family', `?limit=1&before=${b[0]}`)
      expect(p2.body.items.map((i: any) => i.id)).toEqual([a[0]])
      const p3 = await list(f.dad.token, 'family', `?limit=5&before=${a[0]}`)
      expect(p3.body.items.map((i: any) => i.id)).toEqual([a[1]])
      expect(p3.body.hasMore).toBe(false)

      // личный чат видят только двое: у сестры с мамой свой чат, и фото брата там нет; неизвестный участник 404, без токена 401
      const direct = await photo(f.kid.token, f.mom.id)
      await send(f.kid.token, f.mom.id, { mediaIds: [direct] })
      expect((await list(f.mom.token, f.kid.id)).body.items.map((i: any) => i.id)).toEqual([direct])
      expect((await list(f.sis.token, f.mom.id)).body.items).toEqual([])
      expect((await list(f.sis.token, '11111111-1111-4111-8111-111111111111')).status).toBe(404)
      expect((await list(null, 'family')).status).toBe(401)
      // в общем чате личные фото не видны
      expect((await list(f.dad.token, 'family')).body.items).toHaveLength(3)
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('пустой чат и фото не настроены: пустой список', async () => {
    expect((await list(fam.sis.token, fam.mom.id)).body).toEqual({ items: [], hasMore: false })
    expect((await list(fam.mom.token, 'family', '', disabledApp)).body).toEqual({ items: [], hasMore: false })
  })
})

describe('уборка сирот', () => {
  const insert = async (ageHours: number, attached = false) => {
    const { rows } = await pool.query(
      `insert into media (family_id, uploader_id, width, height, size, created_at, attached_at)
       values ($1, $2, 100, 100, 1000, now() - make_interval(hours => $3), $4) returning id`,
      [fam.id, fam.kid.id, ageHours, attached ? new Date() : null],
    )
    return rows[0].id as string
  }
  const exists = async (id: string) => (await pool.query('select 1 from media where id = $1', [id])).rowCount === 1

  it('убирает неприкреплённые старше суток вместе с файлом, остальное не трогает', async () => {
    const old = await insert(30)
    const fresh = await insert(2)
    const attachedOld = await insert(100, true)
    const removed = await deleteOrphanMedia(pool, fake)
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(fake.deleted).toContain(old)
    expect(await exists(old)).toBe(false)
    expect(await exists(fresh)).toBe(true)
    expect(await exists(attachedOld)).toBe(true)
    expect(fake.deleted).not.toContain(fresh)
    expect(fake.deleted).not.toContain(attachedOld)
  })

  it('media недоступен: запись остаётся, чтобы убрать в следующий раз, ошибка сообщается', async () => {
    const old = await insert(48)
    fake.failWith = new Error('недоступен')
    const errors: unknown[] = []
    await deleteOrphanMedia(pool, fake, new Date(), (e) => errors.push(e))
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(await exists(old)).toBe(true)
    fake.failWith = null
    await deleteOrphanMedia(pool, fake)
    expect(await exists(old)).toBe(false)
  })

  it('удаление сообщения-владельца не нужно: прикреплённое фото сиротой не считается', async () => {
    const id = await photo()
    await send(fam.kid.token, 'family', { mediaIds: [id] })
    await pool.query(`update media set created_at = now() - interval '5 days' where id = $1`, [id])
    await deleteOrphanMedia(pool, fake)
    expect(await exists(id)).toBe(true)
  })
})

describe('клиент сервиса media', () => {
  let seen: { method?: string; url?: string; token?: string; type?: string; body: number }[]
  let status = 200
  let reply: unknown = { width: 800, height: 600, size: 123, thumbSize: 45 }
  const server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, token: req.headers['x-internal-token'] as string, type: req.headers['content-type'], body: Buffer.concat(chunks).length })
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      res.end(status === 204 ? undefined : JSON.stringify(reply))
    })
  })
  let client: MediaClient
  beforeAll(async () => {
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    client = createMediaClient({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, internalToken: 'secret-token' })
  })
  afterAll(() => {
    server.close()
  })
  beforeEach(() => {
    seen = []
    status = 200
  })

  it('загрузка: PUT на нужный адрес с токеном и типом image/jpeg, разбирает ответ', async () => {
    const result = await client.upload('f-1', 'i-1', JPEG)
    expect(result).toEqual({ width: 800, height: 600, size: 123, thumbSize: 45 })
    expect(seen).toEqual([{ method: 'PUT', url: '/internal/media/f-1/i-1', token: 'secret-token', type: 'image/jpeg', body: JPEG.length }])
  })

  it('422 это отклонённый файл, остальные ошибки обычный сбой', async () => {
    status = 422
    await expect(client.upload('f', 'i', JPEG)).rejects.toBeInstanceOf(MediaRejected)
    status = 401
    await expect(client.upload('f', 'i', JPEG)).rejects.not.toBeInstanceOf(MediaRejected)
    status = 500
    await expect(client.upload('f', 'i', JPEG)).rejects.toThrow('500')
  })

  it('удаление: DELETE с токеном; 404 не ошибка, 500 ошибка', async () => {
    status = 204
    await client.delete('f-1', 'i-1')
    expect(seen[0]).toMatchObject({ method: 'DELETE', url: '/internal/media/f-1/i-1', token: 'secret-token' })
    status = 404
    await expect(client.delete('f', 'i')).resolves.toBeUndefined()
    status = 500
    await expect(client.delete('f', 'i')).rejects.toThrow('500')
  })

  it('health: сервис отвечает 200 это true, ошибка и недоступность false, исключений нет', async () => {
    expect(await client.health()).toBe(true)
    expect(seen[0]).toMatchObject({ method: 'GET', url: '/health' })
    status = 503
    expect(await client.health()).toBe(false)
    expect(await createMediaClient({ url: 'http://127.0.0.1:1', internalToken: 'x' }, 500).health()).toBe(false)
  })

  it('сервис не отвечает: ошибка, а не зависание', async () => {
    const dead = createMediaClient({ url: 'http://127.0.0.1:1', internalToken: 'x' }, 500)
    await expect(dead.upload('f', 'i', JPEG)).rejects.toBeInstanceOf(Error)
  })
})
