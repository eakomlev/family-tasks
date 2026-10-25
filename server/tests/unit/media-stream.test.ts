import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { limitedStream } from '../../src/chat.js'
import { createMediaClient, MediaRejected } from '../../src/media/client.js'
import { drain } from '../helpers.js'

// Настоящий HTTP-сервер вместо media: проверяем, что тело уходит потоком с точным Content-Length и токеном
interface Seen {
  method?: string
  url?: string
  headers: IncomingMessage['headers']
  size: number
}
let seen: Seen[] = []
let reply: { status: number; body: string } = { status: 200, body: '{"size":0}' }
const server = createServer((req, res) => {
  let size = 0
  req.on('data', (c: Buffer) => (size += c.length))
  req.on('end', () => {
    seen.push({ method: req.method, url: req.url, headers: req.headers, size })
    res.writeHead(reply.status, { 'content-type': 'application/json' })
    res.end(reply.body)
  })
})
let base = ''
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

// поток из N килобайт по частям: целиком в памяти не лежит
const chunks = (kb: number) => Readable.from((function* () { for (let i = 0; i < kb; i++) yield Buffer.alloc(1024, i % 251) })())

describe('клиент media: файлы и видео потоком', () => {
  it('файл: PUT с точным Content-Length, токеном и всеми байтами', async () => {
    seen = []
    reply = { status: 200, body: '{"size":5120}' }
    const client = createMediaClient({ url: base, internalToken: 'secret-token' })
    const result = await client.uploadFile('fam', 'file', chunks(5), 5 * 1024)
    expect(result).toEqual({ size: 5120 })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ method: 'PUT', url: '/internal/files/fam/file', size: 5 * 1024 })
    expect(seen[0].headers['content-length']).toBe(String(5 * 1024))
    expect(seen[0].headers['x-internal-token']).toBe('secret-token')
  })

  it('видео: тип тела, ответ с размерами; отказ сервиса превращается в MediaRejected с кодом', async () => {
    seen = []
    reply = { status: 200, body: JSON.stringify({ width: 720, height: 1280, duration: 5, size: 100, thumbSize: 10 }) }
    const client = createMediaClient({ url: base, internalToken: 't' })
    expect(await client.uploadVideo('fam', 'vid', chunks(3), 3 * 1024, 'video/quicktime')).toMatchObject({ width: 720, duration: 5 })
    expect(seen[0].headers['content-type']).toBe('video/quicktime')
    expect(seen[0].url).toBe('/internal/videos/fam/vid')

    reply = { status: 422, body: '{"error":"video_too_long"}' }
    await expect(client.uploadVideo('fam', 'vid', chunks(1), 1024, 'video/mp4')).rejects.toMatchObject({ code: 'video_too_long' })
    reply = { status: 422, body: '{"error":"invalid_video"}' }
    await expect(client.uploadVideo('fam', 'vid', chunks(1), 1024, 'video/mp4')).rejects.toBeInstanceOf(MediaRejected)
  })

  it('сбой сервиса (5xx) это обычная ошибка, а не отказ по файлу', async () => {
    reply = { status: 500, body: '{}' }
    const client = createMediaClient({ url: base, internalToken: 't' })
    await expect(client.uploadFile('fam', 'f', chunks(1), 1024)).rejects.toThrow(/500/)
    await expect(client.uploadVideo('fam', 'v', chunks(1), 1024, 'video/mp4')).rejects.toThrow(/500/)
  })

  it('сервис недоступен: ошибка соединения', async () => {
    const client = createMediaClient({ url: 'http://127.0.0.1:1', internalToken: 't' })
    await expect(client.uploadFile('fam', 'f', chunks(1), 1024)).rejects.toThrow()
  })
})

describe('limitedStream', () => {
  it('пропускает заявленное и обрывает поток, если пришло больше', async () => {
    expect((await drain(limitedStream(chunks(2), 2048))).length).toBe(2048)
    await expect(drain(limitedStream(chunks(3), 2048))).rejects.toThrow(/larger than declared/)
  })

  it('ошибка исходного потока доходит до получателя', async () => {
    const broken = new Readable({
      read() {
        this.destroy(new Error('соединение оборвано'))
      },
    })
    await expect(drain(limitedStream(broken, 100))).rejects.toThrow('соединение оборвано')
  })
})
