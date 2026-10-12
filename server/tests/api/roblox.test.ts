import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
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
      'https://tr.rbxcdn.com/': () => new Response(png, { status: 200 }),
    })
    const res = await ask(fam.kid.token, 'Kid_1')
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
    const res = await ask(fam.kid.token, 'Kid_1')
    expect(res.status).toBe(502)
    expect(calls.some((c) => c.includes('evil.example'))).toBe(false)
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
