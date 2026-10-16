import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp, keyOf } from '../../src/app.js'
import { sign } from '../../src/sign.js'
import { testConfig, testStore } from '../s3.js'
import { makeJpeg } from '../jpeg.js'

const config = testConfig()
const store = testStore()
// фиксированное «сейчас», чтобы срок подписи проверялся точно
const NOW = new Date('2026-10-13T12:00:00Z')
const nowSeconds = Math.floor(NOW.getTime() / 1000)
const app = buildApp({ config, store, now: () => NOW })
const internal = { 'x-internal-token': config.internalToken }
const families: string[] = []
const newFamily = () => {
  const id = randomUUID()
  families.push(id)
  return id
}
const upload = (family: string, id: string, body: Buffer | string, headers: Record<string, string> = { ...internal, 'content-type': 'image/jpeg' }) =>
  app.inject({ method: 'PUT', url: `/internal/media/${family}/${id}`, headers, payload: body })
const link = (family: string, id: string, variant: 'full' | 'thumb', over: { exp?: number; sig?: string } = {}) => {
  const exp = over.exp ?? nowSeconds + 86400
  return `/media/${family}/${id}/${variant}?exp=${exp}&sig=${over.sig ?? sign(config.secret, family, id, exp)}`
}

beforeAll(async () => {
  await app.ready()
})
afterAll(async () => {
  for (const f of families) await app.inject({ method: 'DELETE', url: `/internal/families/${f}`, headers: internal })
  await app.close()
})

describe('внутренний API', () => {
  it('без токена или с чужим токеном 401, ничего не сохраняется', async () => {
    const family = newFamily()
    const id = randomUUID()
    const jpeg = await makeJpeg(200, 100)
    expect((await upload(family, id, jpeg, { 'content-type': 'image/jpeg' })).statusCode).toBe(401)
    expect((await upload(family, id, jpeg, { 'x-internal-token': 'чужой', 'content-type': 'image/jpeg' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: `/internal/media/${family}` })).statusCode).toBe(401)
    expect((await app.inject({ method: 'DELETE', url: `/internal/families/${family}` })).statusCode).toBe(401)
    expect(await store.get(keyOf(family, id, 'full'))).toBeNull()
  })

  it('загрузка: перекодирует, кладёт полный вариант и превью, возвращает размеры', async () => {
    const family = newFamily()
    const id = randomUUID()
    const res = await upload(family, id, await makeJpeg(3200, 2400, { gps: true }))
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ width: 1600, height: 1200 })
    expect(body.size).toBeGreaterThan(0)
    expect(body.thumbSize).toBeLessThan(body.size)
    const full = await store.get(keyOf(family, id, 'full'))
    expect(full!.size).toBe(body.size)
    const thumb = await store.get(keyOf(family, id, 'thumb'))
    expect(thumb!.size).toBe(body.thumbSize)
  })

  it('не JPEG, мусор, пустое тело и неверный тип содержимого отклоняются', async () => {
    const family = newFamily()
    const id = randomUUID()
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer()
    expect((await upload(family, id, png)).statusCode).toBe(422)
    expect((await upload(family, id, 'мусор')).statusCode).toBe(422)
    expect((await upload(family, id, '', { ...internal, 'content-type': 'image/jpeg' })).statusCode).toBeGreaterThanOrEqual(400)
    expect((await upload(family, id, await makeJpeg(50, 50), { ...internal, 'content-type': 'text/plain' })).statusCode).toBe(415)
    expect(await store.get(keyOf(family, id, 'full'))).toBeNull()
  })

  it('слишком большое тело отклоняется (413)', async () => {
    const family = newFamily()
    const small = buildApp({ config: testConfig({ maxUploadBytes: 1000 }), store })
    const res = await small.inject({
      method: 'PUT', url: `/internal/media/${family}/${randomUUID()}`,
      headers: { ...internal, 'content-type': 'image/jpeg' }, payload: Buffer.alloc(5000),
    })
    expect(res.statusCode).toBe(413)
    await small.close()
  })

  it('идентификаторы не uuid отклоняются: в ключ не попадает произвольный путь', async () => {
    const family = newFamily()
    const jpeg = await makeJpeg(50, 50)
    expect((await upload(family, 'не-uuid', jpeg)).statusCode).toBe(400)
    expect((await upload('..', randomUUID(), jpeg)).statusCode).toBeGreaterThanOrEqual(400)
    expect((await app.inject({ method: 'GET', url: '/internal/media/abc', headers: internal })).statusCode).toBe(400)
    expect((await app.inject({ method: 'DELETE', url: '/internal/families/abc', headers: internal })).statusCode).toBe(400)
  })

  it('список: файлы семьи с размерами полного варианта; чужая семья пуста', async () => {
    const family = newFamily()
    const other = newFamily()
    const a = randomUUID()
    const b = randomUUID()
    const ra = (await upload(family, a, await makeJpeg(800, 600))).json()
    const rb = (await upload(family, b, await makeJpeg(400, 300))).json()
    const list = (await app.inject({ method: 'GET', url: `/internal/media/${family}`, headers: internal })).json()
    expect(list.items.sort((x: any, y: any) => x.id.localeCompare(y.id))).toEqual(
      [{ id: a, size: ra.size }, { id: b, size: rb.size }].sort((x, y) => x.id.localeCompare(y.id)),
    )
    expect((await app.inject({ method: 'GET', url: `/internal/media/${other}`, headers: internal })).json()).toEqual({ items: [] })
  })

  it('удаление файла: оба варианта исчезают, повтор безопасен, соседний файл цел', async () => {
    const family = newFamily()
    const a = randomUUID()
    const b = randomUUID()
    await upload(family, a, await makeJpeg(300, 200))
    await upload(family, b, await makeJpeg(300, 200))
    const del = () => app.inject({ method: 'DELETE', url: `/internal/media/${family}/${a}`, headers: internal })
    expect((await del()).statusCode).toBe(204)
    expect((await del()).statusCode).toBe(204)
    expect(await store.get(keyOf(family, a, 'full'))).toBeNull()
    expect(await store.get(keyOf(family, a, 'thumb'))).toBeNull()
    expect(await store.get(keyOf(family, b, 'full'))).not.toBeNull()
  })

  it('удаление семьи: исчезает всё её, чужая семья цела', async () => {
    const family = newFamily()
    const other = newFamily()
    await upload(family, randomUUID(), await makeJpeg(300, 200))
    await upload(family, randomUUID(), await makeJpeg(300, 200))
    const keep = randomUUID()
    await upload(other, keep, await makeJpeg(300, 200))
    expect((await app.inject({ method: 'DELETE', url: `/internal/families/${family}`, headers: internal })).statusCode).toBe(204)
    expect((await app.inject({ method: 'GET', url: `/internal/media/${family}`, headers: internal })).json()).toEqual({ items: [] })
    expect(await store.get(keyOf(other, keep, 'full'))).not.toBeNull()
  })
})

describe('раздача по подписанной ссылке', () => {
  const setup = async () => {
    const family = newFamily()
    const id = randomUUID()
    await upload(family, id, await makeJpeg(2000, 1000))
    return { family, id }
  }

  it('верная ссылка отдаёт JPEG с кэшем до конца подписи и защитными заголовками', async () => {
    const { family, id } = await setup()
    const res = await app.inject({ method: 'GET', url: link(family, id, 'full') })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/^image\/jpeg/)
    expect(res.headers['cache-control']).toBe('private, max-age=86400')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(await sharp(res.rawPayload).metadata()).toMatchObject({ width: 1600, height: 800, format: 'jpeg' })
  })

  it('превью меньше полного варианта', async () => {
    const { family, id } = await setup()
    const thumb = await app.inject({ method: 'GET', url: link(family, id, 'thumb') })
    expect(thumb.statusCode).toBe(200)
    expect(await sharp(thumb.rawPayload).metadata()).toMatchObject({ width: 480, height: 240 })
  })

  it('срок подписи меньше суток ограничивает кэш', async () => {
    const { family, id } = await setup()
    const res = await app.inject({ method: 'GET', url: link(family, id, 'thumb', { exp: nowSeconds + 600 }) })
    expect(res.headers['cache-control']).toBe('private, max-age=600')
  })

  it('повтор с ETag даёт 304 без тела', async () => {
    const { family, id } = await setup()
    const first = await app.inject({ method: 'GET', url: link(family, id, 'thumb') })
    const etag = first.headers.etag as string
    expect(etag).toBeTruthy()
    const again = await app.inject({ method: 'GET', url: link(family, id, 'thumb'), headers: { 'if-none-match': etag } })
    expect(again.statusCode).toBe(304)
    expect(again.rawPayload.length).toBe(0)
  })

  it('всё, что не должно открываться, отвечает одним и тем же 404', async () => {
    const { family, id } = await setup()
    const stranger = newFamily()
    const missing = randomUUID()
    const bad = [
      ['без подписи', `/media/${family}/${id}/full`],
      ['чужая подпись', link(family, id, 'full', { sig: sign('другой-секрет', family, id, nowSeconds + 86400) })],
      ['подпись обрезана', link(family, id, 'full', { sig: 'abcd' })],
      ['срок истёк', link(family, id, 'full', { exp: nowSeconds - 1 })],
      ['срок слишком далёкий', link(family, id, 'full', { exp: nowSeconds + 30 * 86400 })],
      ['подпись от другого файла', `/media/${family}/${id}/full?exp=${nowSeconds + 86400}&sig=${sign(config.secret, family, randomUUID(), nowSeconds + 86400)}`],
      ['файл другой семьи с подписью своей', `/media/${stranger}/${id}/full?exp=${nowSeconds + 86400}&sig=${sign(config.secret, family, id, nowSeconds + 86400)}`],
      ['нет такого файла (подпись верна)', link(family, missing, 'full')],
      ['неизвестный вариант', link(family, id, 'original' as never)],
      ['идентификатор не uuid', `/media/${family}/..%2F${id}/full?exp=${nowSeconds + 86400}&sig=00`],
    ] as const
    const bodies = new Set<string>()
    for (const [name, url] of bad) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, name).toBe(404)
      bodies.add(res.body)
    }
    expect(bodies.size).toBe(1)
  })

  it('после удаления файла ссылка перестаёт работать', async () => {
    const { family, id } = await setup()
    expect((await app.inject({ method: 'GET', url: link(family, id, 'full') })).statusCode).toBe(200)
    await app.inject({ method: 'DELETE', url: `/internal/media/${family}/${id}`, headers: internal })
    expect((await app.inject({ method: 'GET', url: link(family, id, 'full') })).statusCode).toBe(404)
  })

  it('внутренний API недоступен по публичному пути без токена', async () => {
    const family = newFamily()
    expect((await app.inject({ method: 'GET', url: `/internal/media/${family}` })).statusCode).toBe(401)
  })
})

describe('живость', () => {
  it('/health 200, пока хранилище отвечает', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('/health 503, когда хранилище недоступно, и без подробностей ошибки', async () => {
    const broken = buildApp({ config, store: { ...store, ping: async () => { throw new Error('секрет подключения') } } })
    const res = await broken.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(503)
    expect(res.body).not.toContain('секрет')
    await broken.close()
  })
})

describe('обычные файлы', () => {
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n')
  const putFile = (family: string, id: string, body: Buffer | string, headers: Record<string, string> = { ...internal, 'content-type': 'application/octet-stream' }, target = app) =>
    target.inject({ method: 'PUT', url: `/internal/files/${family}/${id}`, headers, payload: body })
  const fileLink = (family: string, id: string, name?: string) => {
    const exp = nowSeconds + 86400
    const query = `exp=${exp}&sig=${sign(config.secret, family, id, exp)}${name === undefined ? '' : `&name=${encodeURIComponent(name)}`}`
    return `/media/${family}/${id}/file?${query}`
  }

  it('сохраняет байты как есть и отдаёт только как скачиваемый бинарный файл', async () => {
    const family = newFamily()
    const id = randomUUID()
    const res = await putFile(family, id, PDF)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ size: PDF.length })
    const got = await app.inject({ method: 'GET', url: fileLink(family, id, 'Отчёт 2026.pdf') })
    expect(got.statusCode).toBe(200)
    expect(got.rawPayload.equals(PDF)).toBe(true)
    expect(got.headers['content-type']).toMatch(/^application\/octet-stream/)
    expect(got.headers['x-content-type-options']).toBe('nosniff')
    expect(got.headers['content-security-policy']).toMatch(/sandbox/)
    expect(got.headers['content-disposition']).toBe(
      `attachment; filename="_____ 2026.pdf"; filename*=UTF-8''${encodeURIComponent('Отчёт 2026.pdf')}`,
    )
  })

  it('имя для скачивания очищается от путей и управляющих знаков, без имени «file»', async () => {
    const family = newFamily()
    const id = randomUUID()
    await putFile(family, id, PDF)
    const header = async (name?: string) => (await app.inject({ method: 'GET', url: fileLink(family, id, name) })).headers['content-disposition']
    expect(await header('../../etc/passwd')).toContain('filename="_.._etc_passwd"')
    expect(await header('a"; filename="evil.exe')).not.toContain('"evil')
    expect(await header('x\r\nSet-Cookie: a=b')).not.toMatch(/[\r\n]/)
    expect(await header()).toContain('filename="file"')
    expect(await header('.hidden')).toContain('filename="hidden"')
  })

  it('без токена, с неверным id, пустое тело или не те байты (не octet-stream) отклоняются', async () => {
    const family = newFamily()
    const id = randomUUID()
    expect((await putFile(family, id, PDF, { 'content-type': 'application/octet-stream' })).statusCode).toBe(401)
    expect((await putFile('не-uuid', id, PDF)).statusCode).toBe(400)
    expect((await putFile(family, id, Buffer.alloc(0))).statusCode).toBe(415)
    expect((await putFile(family, id, PDF, { ...internal, 'content-type': 'text/html' })).statusCode).toBe(415)
    expect(await store.get(`${family}/${id}/file`)).toBeNull()
  })

  it('файл больше предела для файлов отклоняется (413), а предел фото к файлам не относится', async () => {
    const family = newFamily()
    const small = buildApp({ config: testConfig({ maxFileBytes: 1000 }), store })
    await small.ready()
    expect((await putFile(family, randomUUID(), Buffer.alloc(5000, 1), undefined, small)).statusCode).toBe(413)
    // обычный файл крупнее предела фото (3 МБ) проходит
    expect((await putFile(family, randomUUID(), Buffer.alloc(4 * 1024 * 1024, 7))).statusCode).toBe(200)
    await small.close()
  })

  it('подпись и срок проверяются как у фото: чужая подпись 404', async () => {
    const family = newFamily()
    const id = randomUUID()
    await putFile(family, id, PDF)
    const exp = nowSeconds + 3600
    expect((await app.inject({ method: 'GET', url: `/media/${family}/${id}/file?exp=${exp}&sig=${'0'.repeat(64)}` })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: fileLink(family, randomUUID()) })).statusCode).toBe(404)
  })

  it('список считает размер файла, удаление убирает его (повтор безопасен)', async () => {
    const family = newFamily()
    const id = randomUUID()
    await putFile(family, id, PDF)
    const listed = (await app.inject({ method: 'GET', url: `/internal/media/${family}`, headers: internal })).json()
    expect(listed).toEqual({ items: [{ id, size: PDF.length }] })
    const del = () => app.inject({ method: 'DELETE', url: `/internal/media/${family}/${id}`, headers: internal })
    expect((await del()).statusCode).toBe(204)
    expect((await del()).statusCode).toBe(204)
    expect(await store.get(`${family}/${id}/file`)).toBeNull()
    expect((await app.inject({ method: 'GET', url: fileLink(family, id) })).statusCode).toBe(404)
  })
})
