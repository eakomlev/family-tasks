import type { Readable } from 'node:stream'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { MediaRejected, type MediaClient } from '../../src/media/client.js'
import { attachmentPlaceholder } from '../../src/media/index.js'
import { api, createFamily, drain, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

const SECRET = 'test-media-secret'
const VIDEO = Buffer.from('ftypisom-исходное-видео')

// Замена сервиса media: «сжатое» видео получается вдвое меньше исходного
class FakeMedia implements MediaClient {
  videos: { family: string; id: string; size: number; type: string }[] = []
  deleted: string[] = []
  failWith: Error | null = null
  // пока не пусто, загрузка «идёт»: позволяет проверить одновременные загрузки
  hold: Promise<void> | null = null
  started: (() => void) | null = null
  async upload() {
    return { width: 100, height: 100, size: 1000, thumbSize: 100 }
  }
  async uploadFile(_family: string, _id: string, body: Readable) {
    return { size: (await drain(body)).length }
  }
  async uploadVideo(family: string, id: string, body: Readable, length: number, type: string) {
    if (this.failWith) throw this.failWith
    this.started?.()
    if (this.hold) await this.hold
    const bytes = await drain(body)
    expect(bytes.length).toBe(length)
    this.videos.push({ family, id, size: bytes.length, type })
    return { width: 720, height: 1280, duration: 12, size: Math.ceil(bytes.length / 2), thumbSize: 500 }
  }
  async delete(_family: string, id: string) {
    this.deleted.push(id)
  }
  async health() {
    return true
  }
}

let app: Awaited<ReturnType<typeof buildApp>>
let disabled: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let endpoints: Record<'mom' | 'kid', string>
const fake = new FakeMedia()

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false, media: { client: fake, secret: SECRET } })
  disabled = await buildApp({ logger: false, rateLimit: false, media: null })
  await app.ready()
  await disabled.ready()
  fam = await createFamily()
  endpoints = { mom: await subscribe(fam.mom.id), kid: await subscribe(fam.kid.id) }
})
beforeEach(async () => {
  fake.videos = []
  fake.deleted = []
  fake.failWith = null
  fake.hold = null
  fake.started = null
  await resetSent()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await disabled.close()
  await pool.end()
})

const upload = (token: string | null, chat: string, body: Buffer, type = 'video/mp4', target = app) =>
  target.inject({
    method: 'POST',
    url: `/api/chats/${chat}/videos`,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': type },
    payload: body,
  })
const send = (token: string, chat: string, body: object) => api(app, token, 'POST', `/api/chats/${chat}/messages`, body)
const video = async (token = fam.kid.token, chat = 'family') => (await upload(token, chat, VIDEO)).json().videoId as string

describe('загрузка видео', () => {
  it('передаёт видео сервису media и записывает его за автором с размерами и длительностью', async () => {
    const res = await upload(fam.kid.token, 'family', VIDEO, 'video/quicktime')
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toMatchObject({ width: 720, height: 1280, duration: 12 })
    expect(fake.videos).toEqual([{ family: fam.id, id: body.videoId, size: VIDEO.length, type: 'video/quicktime' }])
    const { rows } = await pool.query('select kind, width, height, duration, size, uploader_id, attached_at from media where id = $1', [body.videoId])
    expect(rows[0]).toMatchObject({ kind: 'video', width: 720, height: 1280, duration: 12, size: Math.ceil(VIDEO.length / 2), uploader_id: fam.kid.id, attached_at: null })
  })

  it('не видео, пустое тело, без токена, чужой чат, медиа выключено', async () => {
    expect((await upload(fam.kid.token, 'family', VIDEO, 'image/jpeg')).statusCode).toBe(415)
    expect((await upload(fam.kid.token, 'family', Buffer.alloc(0))).statusCode).toBe(400)
    expect((await upload(null, 'family', VIDEO)).statusCode).toBe(401)
    expect((await upload(fam.kid.token, '11111111-1111-4111-8111-111111111111', VIDEO)).statusCode).toBe(404)
    expect((await upload(fam.kid.token, 'family', VIDEO, 'video/mp4', disabled)).statusCode).toBe(503)
  })

  it('сервис media отверг файл: 400 с понятным кодом, записи нет', async () => {
    const before = (await pool.query('select count(*)::int as n from media where family_id = $1', [fam.id])).rows[0].n
    fake.failWith = new MediaRejected('video_too_long')
    expect((await upload(fam.kid.token, 'family', VIDEO)).json()).toEqual({ error: 'video_too_long' })
    fake.failWith = new MediaRejected('invalid_video')
    expect((await upload(fam.kid.token, 'family', VIDEO)).json()).toEqual({ error: 'invalid_video' })
    // сжатие оборвано (нехватка памяти или время): отдельный код, чтобы не говорить «не видео»
    fake.failWith = new MediaRejected('video_failed')
    expect((await upload(fam.kid.token, 'family', VIDEO)).json()).toEqual({ error: 'video_failed' })
    expect((await pool.query('select count(*)::int as n from media where family_id = $1', [fam.id])).rows[0].n).toBe(before)
  })

  it('одновременно у семьи одна загрузка: вторая сразу получает 503 media_busy, после окончания первой снова можно', async () => {
    let release!: () => void
    fake.hold = new Promise<void>((r) => (release = r))
    const started = new Promise<void>((r) => (fake.started = r))
    const first = upload(fam.kid.token, 'family', VIDEO)
    await started
    const second = await upload(fam.mom.token, 'family', VIDEO)
    expect(second.statusCode).toBe(503)
    expect(second.json()).toEqual({ error: 'media_busy' })
    expect(second.headers['retry-after']).toBe('60')
    release()
    expect((await first).statusCode).toBe(201)
    expect((await upload(fam.kid.token, 'family', VIDEO)).statusCode).toBe(201)
    // сбой загрузки тоже освобождает место
    fake.failWith = new Error('boom')
    expect((await upload(fam.kid.token, 'family', VIDEO)).statusCode).toBe(502)
    fake.failWith = null
    expect((await upload(fam.kid.token, 'family', VIDEO)).statusCode).toBe(201)
  })

  it('сервис media недоступен: 502 без подробностей', async () => {
    fake.failWith = new Error('secret details')
    const res = await upload(fam.kid.token, 'family', VIDEO)
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'media_unavailable' })
  })

  it('больше предела 413, квота семьи общая с фото и файлами', async () => {
    vi.stubEnv('MAX_VIDEO_BYTES', '10')
    try {
      // предел читается при регистрации маршрута: новое приложение
      const small = await buildApp({ logger: false, rateLimit: false, media: { client: fake, secret: SECRET } })
      await small.ready()
      expect((await upload(fam.kid.token, 'family', Buffer.alloc(50, 1), 'video/mp4', small)).statusCode).toBe(413)
      await small.close()
    } finally {
      vi.unstubAllEnvs()
    }
    const f = await createFamily()
    try {
      vi.stubEnv('MEDIA_QUOTA_BYTES', String(VIDEO.length + 5))
      expect((await upload(f.kid.token, 'family', VIDEO)).statusCode).toBe(201)
      const second = await upload(f.kid.token, 'family', Buffer.alloc(VIDEO.length * 2, 1))
      expect(second.statusCode).toBe(413)
      expect(second.json().error).toBe('media_quota')
    } finally {
      vi.unstubAllEnvs()
      await removeFamilies(f.id)
    }
  })
})

describe('сообщение с видео', () => {
  it('видео без подписи: заглушка в text, пустая подпись, адреса подписаны, размеры и длительность в ответе', async () => {
    const id = await video()
    const res = await send(fam.kid.token, 'family', { videoIds: [id] })
    expect(res.status).toBe(201)
    const message = res.body.message
    expect(message.text).toBe('🎬 Видео')
    expect(message.caption).toBe('')
    expect(message.media).toEqual([])
    expect(message.videos).toHaveLength(1)
    expect(message.videos[0]).toMatchObject({ id, width: 720, height: 1280, duration: 12 })
    expect(message.videos[0].url).toMatch(new RegExp(`^/media/${fam.id}/${id}/video\\?exp=\\d+&sig=[0-9a-f]+$`))
    expect(message.videos[0].thumbUrl).toMatch(new RegExp(`^/media/${fam.id}/${id}/thumb\\?exp=\\d+&sig=`))
    // видео не попадает в список фото чата
    const photos = await api(app, fam.mom.token, 'GET', '/api/chats/family/media')
    expect(photos.body.items.map((i: { id: string }) => i.id)).not.toContain(id)
  })

  it('с подписью: подпись остаётся, видео приходит и в списке сообщений', async () => {
    const id = await video()
    await send(fam.kid.token, 'family', { text: 'смотрите, как я', videoIds: [id] })
    const list = await api(app, fam.mom.token, 'GET', '/api/chats/family/messages')
    const message = list.body.messages.find((m: { videos: { id: string }[] }) => m.videos.some((v) => v.id === id))
    expect(message).toMatchObject({ text: 'смотрите, как я', caption: 'смотрите, как я' })
  })

  it('фото, файлы и видео вместе; виды не путаются', async () => {
    const v = await video()
    // видео нельзя отправить как фото и наоборот
    expect((await send(fam.kid.token, 'family', { mediaIds: [v] })).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { fileIds: [v] })).status).toBe(400)
    const photo = (await api(app, fam.kid.token, 'GET', '/api/chats/family/messages')).body
    expect(photo).toBeTruthy()
    expect((await send(fam.kid.token, 'family', { videoIds: [v] })).status).toBe(201)
  })

  it('больше трёх видео, чужое и уже прикреплённое видео не принимаются', async () => {
    const four = [await video(), await video(), await video(), await video()]
    expect((await send(fam.kid.token, 'family', { videoIds: four })).status).toBe(400)
    const mine = await video(fam.kid.token)
    expect((await send(fam.mom.token, 'family', { videoIds: [mine] })).body.error).toBe('invalid_media')
    expect((await send(fam.kid.token, 'family', { videoIds: [mine] })).status).toBe(201)
    expect((await send(fam.kid.token, 'family', { videoIds: [mine] })).body.error).toBe('invalid_media')
  })

  it('уведомление: «🎬 Видео» или «🎬 подпись» (уведомления одного чата склеиваются, поэтому смотрим по одному)', async () => {
    await send(fam.kid.token, 'family', { videoIds: [await video()] })
    expect((await sentTo([endpoints.mom])).at(-1)!.payload.body).toBe('🎬 Видео')
    await resetSent()
    await send(fam.kid.token, 'family', { text: 'вот', videoIds: [await video()] })
    expect((await sentTo([endpoints.mom])).at(-1)!.payload.body).toBe('🎬 вот')
  })

  it('очистка чата убирает и видео вместе с записью', async () => {
    const f = await createFamily()
    try {
      const id = (await upload(f.kid.token, 'family', VIDEO)).json().videoId as string
      await api(app, f.kid.token, 'POST', '/api/chats/family/messages', { videoIds: [id] })
      expect((await api(app, f.mom.token, 'DELETE', '/api/chats/family/messages')).status).toBe(204)
      expect((await pool.query('select 1 from media where id = $1', [id])).rowCount).toBe(0)
      expect(fake.deleted).toContain(id)
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('заглушка для старых клиентов', () => {
  it('одно и несколько видео, смешанные вложения', () => {
    expect(attachmentPlaceholder(0, [], 1)).toBe('🎬 Видео')
    expect(attachmentPlaceholder(0, [], 3)).toBe('🎬 Видео ×3')
    expect(attachmentPlaceholder(2, [], 1)).toBe('📎 Вложения ×3')
    expect(attachmentPlaceholder(0, [{ name: 'a.pdf' }], 1)).toBe('📎 Вложения ×2')
    expect(attachmentPlaceholder(2, [])).toBe('📷 Фото ×2')
  })
})
