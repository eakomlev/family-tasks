import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp, keyOf, videoKeyOf } from '../../src/app.js'
import { sign } from '../../src/sign.js'
import { InvalidVideo, type VideoProcessor } from '../../src/video.js'
import { makeJpeg } from '../jpeg.js'
import { testConfig, testStore } from '../s3.js'

const config = testConfig()
const store = testStore()
const NOW = new Date('2026-10-13T12:00:00Z')
const nowSeconds = Math.floor(NOW.getTime() / 1000)
const internal = { 'x-internal-token': config.internalToken }
const families: string[] = []
const newFamily = () => {
  const id = randomUUID()
  families.push(id)
  return id
}

// Замена ffmpeg: настоящая обработка проверяется отдельно (video.test.ts в unit, если ffmpeg установлен)
const VIDEO = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251))
let mode: 'ok' | 'invalid' | 'long' = 'ok'
let thumb: Buffer
// путь исходного файла и папки результата (проверяем, что сервис за собой убирает)
let processedFrom = ''
const resultDirs: string[] = []
const processor: VideoProcessor = {
  async process(inputPath) {
    processedFrom = inputPath
    if (mode === 'invalid') throw new InvalidVideo('invalid_video')
    if (mode === 'long') throw new InvalidVideo('video_too_long')
    const dir = mkdtempSync(join(tmpdir(), 'fake-video-'))
    resultDirs.push(dir)
    const videoPath = join(dir, 'out.mp4')
    writeFileSync(videoPath, VIDEO)
    return { videoPath, size: VIDEO.length, thumb, width: 720, height: 1280, duration: 12, cleanup: async () => rmSync(dir, { recursive: true, force: true }) }
  },
}
const app = buildApp({ config, store, now: () => NOW, video: processor })
const appWithoutVideo = buildApp({ config, store, now: () => NOW })

const upload = (family: string, id: string, headers: Record<string, string> = { ...internal, 'content-type': 'video/mp4' }, application = app) =>
  application.inject({ method: 'PUT', url: `/internal/videos/${family}/${id}`, headers, payload: Buffer.from('исходное видео') })
const link = (family: string, id: string, variant: string, over: { exp?: number; sig?: string } = {}) => {
  const exp = over.exp ?? nowSeconds + 86400
  return `/media/${family}/${id}/${variant}?exp=${exp}&sig=${over.sig ?? sign(config.secret, family, id, exp)}`
}

beforeAll(async () => {
  thumb = await makeJpeg(480, 270)
  await app.ready()
  await appWithoutVideo.ready()
})
afterAll(async () => {
  resultDirs.forEach((d) => rmSync(d, { recursive: true, force: true }))
  for (const f of families) await app.inject({ method: 'DELETE', url: `/internal/families/${f}`, headers: internal })
  await app.close()
  await appWithoutVideo.close()
})

describe('загрузка видео', () => {
  it('без токена 401, ничего не сохраняется', async () => {
    const family = newFamily()
    const id = randomUUID()
    expect((await upload(family, id, { 'content-type': 'video/mp4' })).statusCode).toBe(401)
    expect(await store.get(videoKeyOf(family, id))).toBeNull()
  })

  it('кладёт видео и превью, отвечает размерами и длительностью', async () => {
    mode = 'ok'
    const family = newFamily()
    const id = randomUUID()
    const res = await upload(family, id)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ width: 720, height: 1280, duration: 12, size: VIDEO.length })
    expect((await store.get(videoKeyOf(family, id)))!.size).toBe(VIDEO.length)
    expect((await store.get(keyOf(family, id, 'thumb')))!.size).toBe(thumb.length)
  })

  it('не видео и слишком длинное: 422 с кодом, ничего не сохраняется', async () => {
    const family = newFamily()
    const id = randomUUID()
    mode = 'invalid'
    const bad = await upload(family, id)
    expect(bad.statusCode).toBe(422)
    expect(bad.json()).toEqual({ error: 'invalid_video' })
    mode = 'long'
    const long = await upload(family, id)
    expect(long.statusCode).toBe(422)
    expect(long.json()).toEqual({ error: 'video_too_long' })
    expect(await store.get(videoKeyOf(family, id))).toBeNull()
    mode = 'ok'
  })

  it('исходный файл принимается потоком на диск, после обработки и он, и результат убраны', async () => {
    mode = 'ok'
    expect((await upload(newFamily(), randomUUID())).statusCode).toBe(200)
    expect(processedFrom).toContain('upload-')
    expect(existsSync(processedFrom)).toBe(false)
    expect(resultDirs.every((d) => !existsSync(d))).toBe(true)
  })

  it('слишком большое тело: отказ, ничего не сохраняется', async () => {
    mode = 'ok'
    const small = buildApp({ config: { ...config, maxVideoBytes: 10 }, store, now: () => NOW, video: processor })
    await small.ready()
    const family = newFamily()
    const id = randomUUID()
    const res = await small.inject({ method: 'PUT', url: `/internal/videos/${family}/${id}`, headers: { ...internal, 'content-type': 'video/mp4' }, payload: Buffer.alloc(50, 1) })
    expect([400, 413]).toContain(res.statusCode)
    expect(await store.get(videoKeyOf(family, id))).toBeNull()
    await small.close()
  })

  it('чужой тип тела и неверный идентификатор', async () => {
    const family = newFamily()
    expect((await upload(family, randomUUID(), { ...internal, 'content-type': 'text/plain' })).statusCode).toBe(415)
    expect((await upload(family, 'не-uuid')).statusCode).toBe(400)
    // пустое тело
    const empty = await app.inject({ method: 'PUT', url: `/internal/videos/${family}/${randomUUID()}`, headers: { ...internal, 'content-type': 'video/mp4' }, payload: Buffer.alloc(0) })
    expect(empty.statusCode).toBe(415)
  })

  it('без обработчика видео 503', async () => {
    expect((await upload(newFamily(), randomUUID(), { ...internal, 'content-type': 'video/mp4' }, appWithoutVideo)).statusCode).toBe(503)
  })
})

describe('раздача видео', () => {
  async function stored() {
    mode = 'ok'
    const family = newFamily()
    const id = randomUUID()
    await upload(family, id)
    return { family, id }
  }

  it('целиком: тип video/mp4 и признак поддержки Range', async () => {
    const { family, id } = await stored()
    const res = await app.inject({ method: 'GET', url: link(family, id, 'video') })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('video/mp4')
    expect(res.headers['accept-ranges']).toBe('bytes')
    expect(res.rawPayload.equals(VIDEO)).toBe(true)
  })

  it('по частям: 206 и Content-Range, в том числе «до конца»', async () => {
    const { family, id } = await stored()
    const part = await app.inject({ method: 'GET', url: link(family, id, 'video'), headers: { range: 'bytes=100-199' } })
    expect(part.statusCode).toBe(206)
    expect(part.headers['content-range']).toBe(`bytes 100-199/${VIDEO.length}`)
    expect(part.rawPayload.equals(VIDEO.subarray(100, 200))).toBe(true)
    const tail = await app.inject({ method: 'GET', url: link(family, id, 'video'), headers: { range: 'bytes=900-' } })
    expect(tail.statusCode).toBe(206)
    expect(tail.rawPayload.equals(VIDEO.subarray(900))).toBe(true)
  })

  it('диапазон не по правилам или за пределами файла: 416', async () => {
    const { family, id } = await stored()
    for (const range of ['bytes=abc', 'bytes=200-100', 'bytes=5000-6000']) {
      expect((await app.inject({ method: 'GET', url: link(family, id, 'video'), headers: { range } })).statusCode).toBe(416)
    }
  })

  it('превью лежит рядом как у фото; без подписи и с чужой семьёй одинаковое 404', async () => {
    const { family, id } = await stored()
    expect((await app.inject({ method: 'GET', url: link(family, id, 'thumb') })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: link(family, id, 'video', { sig: 'x' }) })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: link(newFamily(), id, 'video') })).statusCode).toBe(404)
  })

  it('удаление убирает и видео, и превью; в списке семьи размер видео считается', async () => {
    const { family, id } = await stored()
    const list = await app.inject({ method: 'GET', url: `/internal/media/${family}`, headers: internal })
    expect(list.json().items).toContainEqual({ id, size: VIDEO.length })
    expect((await app.inject({ method: 'DELETE', url: `/internal/media/${family}/${id}`, headers: internal })).statusCode).toBe(204)
    expect(await store.get(videoKeyOf(family, id))).toBeNull()
    expect(await store.get(keyOf(family, id, 'thumb'))).toBeNull()
  })
})
