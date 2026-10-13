import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { createLookup, imageSource } from '../../src/roblox.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
})
afterEach(() => vi.unstubAllGlobals())
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const png = Buffer.from('fake-png-bytes')
const ask = (token: string, username: unknown) => api(app, token, 'POST', '/api/me/roblox-avatar', { username })

// подмена внешних запросов к Roblox: по адресу отдаём заготовленный ответ
function stubRoblox(routes: Record<string, () => Response>) {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const url = String(input)
    calls.push(url)
    const key = Object.keys(routes).find((k) => url.startsWith(k))
    if (!key) throw new Error(`неожиданный запрос ${url}`)
    return routes[key]()
  })
  return calls
}
const okJson = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 })

describe('POST /api/me/roblox-avatar', () => {
  it('по нику отдаёт картинку аватара data URL', async () => {
    stubRoblox({
      'https://users.roblox.com/': okJson({ data: [{ id: 42, name: 'Kid' }] }),
      'https://thumbnails.roblox.com/': okJson({ data: [{ imageUrl: 'https://tr.rbxcdn.com/abc/150/150/AvatarHeadshot/Png' }] }),
    })
    // картинку скачивает отдельная функция (со своим DNS), сеть в тесте не нужна
    const download = vi.spyOn(imageSource, 'download').mockResolvedValue(png)
    const res = await ask(fam.kid.token, 'Kid_1')
    expect(String(download.mock.calls[0][0])).toBe('https://tr.rbxcdn.com/abc/150/150/AvatarHeadshot/Png')
    download.mockRestore()
    expect(res.status).toBe(200)
    expect(res.body.image).toBe(`data:image/png;base64,${png.toString('base64')}`)
  })

  it('нет такого игрока: 404', async () => {
    stubRoblox({ 'https://users.roblox.com/': okJson({ data: [] }) })
    const res = await ask(fam.kid.token, 'NoSuchUser')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('roblox_user_not_found')
  })

  it('картинка не с CDN Roblox не скачивается', async () => {
    const calls = stubRoblox({
      'https://users.roblox.com/': okJson({ data: [{ id: 42 }] }),
      'https://thumbnails.roblox.com/': okJson({ data: [{ imageUrl: 'https://evil.example/x.png' }] }),
    })
    const download = vi.spyOn(imageSource, 'download').mockResolvedValue(png)
    const res = await ask(fam.kid.token, 'Kid_1')
    expect(res.status).toBe(502)
    expect(calls.some((c) => c.includes('evil.example'))).toBe(false)
    expect(download).not.toHaveBeenCalled()
    download.mockRestore()
  })

  it('Roblox недоступен: 502', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('нет связи')
    })
    expect((await ask(fam.kid.token, 'Kid_1')).status).toBe(502)
  })

  it('только детям, только с токеном, ник проверяется', async () => {
    expect((await ask(fam.mom.token, 'Kid_1')).status).toBe(403)
    expect((await api(app, 'чужой', 'POST', '/api/me/roblox-avatar', { username: 'Kid_1' })).status).toBe(401)
    expect((await ask(fam.kid.token, 'a')).status).toBe(400)
    expect((await ask(fam.kid.token, 'плохой ник!')).status).toBe(400)
  })
})

describe('картинка аватара: DNS', () => {
  const ok = (address: string) => (_host: string, _options: object, cb: (e: null, a: string, f: number) => void) => cb(null, address, 4)
  const fail = (_host: string, _options: object, cb: (e: NodeJS.ErrnoException) => void) => cb(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }))

  it('системный DNS нашёл имя: публичный не спрашиваем', () => {
    const resolve4 = vi.fn()
    const done = vi.fn()
    createLookup(ok('1.2.3.4') as never, resolve4)('tr.rbxcdn.com', {}, done)
    expect(done).toHaveBeenCalledWith(null, '1.2.3.4', 4)
    expect(resolve4).not.toHaveBeenCalled()
  })

  it('системный не нашёл (как у хостера): адрес берётся из публичного DNS', () => {
    const resolve4 = vi.fn((_h: string, cb: (e: null, a: string[]) => void) => cb(null, ['9.9.9.9', '8.8.4.4']))
    const done = vi.fn()
    createLookup(fail as never, resolve4 as never)('tr.rbxcdn.com', {}, done)
    expect(resolve4).toHaveBeenCalledWith('tr.rbxcdn.com', expect.any(Function))
    expect(done).toHaveBeenCalledWith(null, '9.9.9.9', 4)
  })

  it('Node просит все адреса (options.all): отдаём список', () => {
    const resolve4 = (_h: string, cb: (e: null, a: string[]) => void) => cb(null, ['9.9.9.9', '8.8.4.4'])
    const done = vi.fn()
    createLookup(fail as never, resolve4 as never)('tr.rbxcdn.com', { all: true }, done)
    expect(done).toHaveBeenCalledWith(null, [{ address: '9.9.9.9', family: 4 }, { address: '8.8.4.4', family: 4 }])
  })

  it('не нашёл ни тот, ни другой: ошибка системного DNS', () => {
    const resolve4 = (_h: string, cb: (e: Error) => void) => cb(new Error('нет'))
    const done = vi.fn()
    createLookup(fail as never, resolve4 as never)('tr.rbxcdn.com', {}, done)
    expect(done.mock.calls[0][0]).toMatchObject({ code: 'ENOTFOUND' })
  })
})
