import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import type { MediaClient } from '../../src/media/client.js'
import { cleanFileName, isBlockedFile } from '../../src/media/index.js'
import { sign } from '../../src/media/sign.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

const SECRET = 'test-media-secret'
const PDF = Buffer.from('%PDF-1.4 test')

class FakeMedia implements MediaClient {
  files: { family: string; id: string; size: number }[] = []
  deleted: string[] = []
  failWith: Error | null = null
  async upload() {
    return { width: 100, height: 100, size: 1000, thumbSize: 100 }
  }
  async uploadFile(family: string, id: string, body: Buffer) {
    if (this.failWith) throw this.failWith
    this.files.push({ family, id, size: body.length })
    return { size: body.length }
  }
  async delete(_family: string, id: string) {
    this.deleted.push(id)
  }
  async uploadVideo(): Promise<never> {
    throw new Error('видео в этом тесте не загружается')
  }
  async health() {
    return true
  }
}

let app: Awaited<ReturnType<typeof buildApp>>
let disabled: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
const fake = new FakeMedia()

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false, media: { client: fake, secret: SECRET } })
  disabled = await buildApp({ logger: false, rateLimit: false, media: null })
  await app.ready()
  await disabled.ready()
  fam = await createFamily()
})
beforeEach(() => {
  fake.files = []
  fake.deleted = []
  fake.failWith = null
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await disabled.close()
  await pool.end()
})

const upload = (token: string | null, chat: string, body: Buffer | string, name: string | null = 'Отчёт.pdf', target = app) =>
  target.inject({
    method: 'POST',
    url: `/api/chats/${chat}/files`,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/octet-stream',
      ...(name === null ? {} : { 'x-file-name': encodeURIComponent(name) }),
    },
    payload: body,
  })
const send = (token: string, chat: string, body: object, target = app) => api(target, token, 'POST', `/api/chats/${chat}/messages`, body)
const file = async (token = fam.kid.token, chat = 'family', name = 'Отчёт.pdf') => (await upload(token, chat, PDF, name)).json().fileId as string

describe('загрузка файла', () => {
  it('сохраняет файл в сервисе media и запись за автором; имя берётся из заголовка', async () => {
    const res = await upload(fam.kid.token, 'family', PDF, 'Домашка 5Б.docx')
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toMatchObject({ name: 'Домашка 5Б.docx', size: PDF.length })
    expect(fake.files).toEqual([{ family: fam.id, id: body.fileId, size: PDF.length }])
    const { rows } = await pool.query('select kind, file_name, size, uploader_id, attached_at, width from media where id = $1', [body.fileId])
    expect(rows[0]).toMatchObject({ kind: 'file', file_name: 'Домашка 5Б.docx', size: PDF.length, uploader_id: fam.kid.id, attached_at: null, width: null })
  })

  it('исполняемое, сценарии и страницы не принимаются (415), обычные документы да', async () => {
    for (const name of ['setup.exe', 'run.BAT', 'a.js', 'page.html', 'x.svg', 'отчёт.pdf.exe', 'tool.sh']) {
      const res = await upload(fam.kid.token, 'family', PDF, name)
      expect(res.statusCode, name).toBe(415)
      expect(res.json().error).toBe('file_type_blocked')
    }
    for (const name of ['a.pdf', 'b.docx', 'c.xlsx', 'd.zip', 'e.txt', 'f.mp3', 'Makefile', 'отчёт.final.pdf']) {
      expect((await upload(fam.kid.token, 'family', PDF, name)).statusCode, name).toBe(201)
    }
  })

  it('без имени, пустой файл, без токена, чужой чат, медиа выключено', async () => {
    expect((await upload(fam.kid.token, 'family', PDF, null)).statusCode).toBe(400)
    expect((await upload(fam.kid.token, 'family', PDF, '...')).statusCode).toBe(400)
    expect((await upload(fam.kid.token, 'family', Buffer.alloc(0))).statusCode).toBe(400)
    expect((await upload(null, 'family', PDF)).statusCode).toBe(401)
    expect((await upload(fam.kid.token, '11111111-1111-4111-8111-111111111111', PDF)).statusCode).toBe(404)
    expect((await upload(fam.kid.token, 'family', PDF, 'a.pdf', disabled)).statusCode).toBe(503)
  })

  it('больше предела файла 413, квота семьи общая с фото', async () => {
    vi.stubEnv('MAX_FILE_BYTES', '10')
    try {
      // предел читается при регистрации маршрута: новое приложение
      const small = await buildApp({ logger: false, rateLimit: false, media: { client: fake, secret: SECRET } })
      await small.ready()
      expect((await upload(fam.kid.token, 'family', Buffer.alloc(50, 1), 'a.bin', small)).statusCode).toBe(413)
      await small.close()
    } finally {
      vi.unstubAllEnvs()
    }
    const f = await createFamily()
    try {
      vi.stubEnv('MEDIA_QUOTA_BYTES', String(PDF.length + 5))
      expect((await upload(f.kid.token, 'family', PDF)).statusCode).toBe(201)
      const second = await upload(f.kid.token, 'family', PDF)
      expect(second.statusCode).toBe(413)
      expect(second.json().error).toBe('media_quota')
    } finally {
      vi.unstubAllEnvs()
      await removeFamilies(f.id)
    }
  })

  it('сервис media недоступен: 502 без подробностей, записи в базе нет', async () => {
    fake.failWith = new Error('secret details')
    const before = (await pool.query('select count(*)::int as n from media where family_id = $1', [fam.id])).rows[0].n
    const res = await upload(fam.kid.token, 'family', PDF)
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'media_unavailable' })
    expect((await pool.query('select count(*)::int as n from media where family_id = $1', [fam.id])).rows[0].n).toBe(before)
  })
})

describe('сообщение с файлами', () => {
  it('файл без подписи: заглушка в text, пустая подпись, ссылка на скачивание с подписью и именем', async () => {
    const id = await file(fam.kid.token, 'family', 'Расписание.pdf')
    const res = await send(fam.kid.token, 'family', { fileIds: [id] })
    expect(res.status).toBe(201)
    const { message } = res.body
    expect(message).toMatchObject({ text: '📎 Расписание.pdf', caption: '', media: [] })
    expect(message.files).toHaveLength(1)
    const [f] = message.files
    expect(f).toMatchObject({ id, name: 'Расписание.pdf', size: PDF.length })
    const url = new URL(f.url, 'http://x')
    expect(url.pathname).toBe(`/media/${fam.id}/${id}/file`)
    const exp = Number(url.searchParams.get('exp'))
    expect(url.searchParams.get('sig')).toBe(sign(SECRET, fam.id, id, exp))
    expect(url.searchParams.get('name')).toBe('Расписание.pdf')
    expect((await pool.query('select attached_at from media where id = $1', [id])).rows[0].attached_at).not.toBeNull()
  })

  it('несколько файлов, подпись и история: порядок сохраняется, фото отдельно от файлов', async () => {
    const a = await file(fam.kid.token, 'family', 'a.pdf')
    const b = await file(fam.kid.token, 'family', 'b.zip')
    const photoRes = await upload(fam.kid.token, 'family', Buffer.from([0xff, 0xd8, 0xff]), 'p.jpg') // файл, не фото
    expect(photoRes.statusCode).toBe(201)
    const res = await send(fam.kid.token, 'family', { text: ' смотри ', fileIds: [b, a] })
    expect(res.body.message).toMatchObject({ text: 'смотри', caption: 'смотри' })
    expect(res.body.message.files.map((f: any) => f.name)).toEqual(['b.zip', 'a.pdf'])
    const history = (await api(app, fam.mom.token, 'GET', '/api/chats/family/messages')).body.messages
    const found = history.find((m: any) => m.id === res.body.message.id)
    expect(found.files.map((f: any) => f.name)).toEqual(['b.zip', 'a.pdf'])
    expect(found.media).toEqual([])
    // старые сообщения без файлов получают пустой список
    expect(history.every((m: any) => Array.isArray(m.files))).toBe(true)
    const two = await send(fam.kid.token, 'family', { fileIds: [await file(), await file()] })
    expect(two.body.message.text).toBe('📎 Файлы ×2')
  })

  it('виды не путаются: файл нельзя отправить как фото и наоборот; чужой и уже прикреплённый отвергаются', async () => {
    const id = await file()
    expect((await send(fam.kid.token, 'family', { mediaIds: [id] })).status).toBe(400)
    expect((await send(fam.sis.token, 'family', { fileIds: [id] })).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { fileIds: [id] })).status).toBe(201)
    expect((await send(fam.kid.token, 'family', { fileIds: [id] })).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { fileIds: ['11111111-1111-4111-8111-111111111111'] })).status).toBe(400)
  })

  it('не больше 5 файлов в сообщении; медиа выключено 503', async () => {
    const ids = [] as string[]
    for (let i = 0; i < 6; i++) ids.push(await file())
    expect((await send(fam.kid.token, 'family', { fileIds: ids })).status).toBe(400)
    expect((await send(fam.kid.token, 'family', { fileIds: ids.slice(0, 1) }, disabled)).status).toBe(503)
  })

  it('в списке чатов у последнего сообщения есть файлы; в «Медиа файлах» только фото', async () => {
    const f = await createFamily()
    try {
      const id = (await upload(f.kid.token, 'family', PDF, 'Итог.pdf')).json().fileId as string
      await send(f.kid.token, 'family', { fileIds: [id] })
      const chats = (await api(app, f.mom.token, 'GET', '/api/chats')).body.chats
      expect(chats.find((c: any) => c.id === 'family').last.files).toHaveLength(1)
      expect((await api(app, f.mom.token, 'GET', '/api/chats/family/media')).body.items).toEqual([])
    } finally {
      await removeFamilies(f.id)
    }
  })

  it('очистка чата убирает записи файлов и сам файл в хранилище', async () => {
    const f = await createFamily()
    try {
      const id = (await upload(f.kid.token, 'family', PDF, 'x.pdf')).json().fileId as string
      await send(f.kid.token, 'family', { fileIds: [id] })
      expect((await api(app, f.mom.token, 'DELETE', '/api/chats/family/messages')).status).toBe(204)
      expect((await pool.query('select 1 from media where id = $1', [id])).rowCount).toBe(0)
      expect(fake.deleted).toContain(id)
    } finally {
      await removeFamilies(f.id)
    }
  })
})

describe('имя файла', () => {
  it('очищается от пути и управляющих знаков, длинное укорачивается с сохранением расширения', () => {
    expect(cleanFileName('C:\\Users\\Миша\\отчёт.pdf')).toBe('отчёт.pdf')
    expect(cleanFileName('../../etc/passwd')).toBe('passwd')
    expect(cleanFileName('a\r\nb.txt')).toBe('ab.txt')
    expect(cleanFileName('...')).toBeNull()
    expect(cleanFileName('   ')).toBeNull()
    const long = cleanFileName(`${'я'.repeat(300)}.docx`)!
    expect(long.length).toBeLessThanOrEqual(120)
    expect(long.endsWith('.docx')).toBe(true)
  })

  it('опасные расширения определяются по последнему', () => {
    expect(isBlockedFile('x.EXE')).toBe(true)
    expect(isBlockedFile('x.pdf.exe')).toBe(true)
    expect(isBlockedFile('x.exe.pdf')).toBe(false)
    expect(isBlockedFile('README')).toBe(false)
  })
})
