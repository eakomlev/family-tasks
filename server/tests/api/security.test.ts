import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { RouteOptions } from 'fastify'
import { buildApp } from '../../src/app.js'
import { deleteExpiredSessions, SESSION_TTL_DAYS } from '../../src/auth.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

const routes: RouteOptions[] = []
let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false, onRoute: (route) => routes.push(route) })
  await app.ready()
  fam = await createFamily()
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

// Открытые маршруты (без токена). Новый маршрут сюда добавляется только осознанно: по умолчанию весь /api закрыт.
const PUBLIC = [
  'GET /api/health',
  'GET /api/push/config',
  'POST /api/email-codes',
  'POST /api/families',
  'GET /api/invites/:code',
  'POST /api/invites/:code/join',
  'POST /api/auth/login',
  'DELETE /api/session',
  'GET /api/ws',
]

const apiRoutes = () =>
  routes
    .filter((r) => String(r.url).startsWith('/api/'))
    .flatMap((r) => (Array.isArray(r.method) ? r.method : [r.method]).map((method) => ({ method: String(method), url: String(r.url), config: r.config as { public?: boolean } | undefined })))
    // HEAD Fastify добавляет к каждому GET сам
    .filter((r) => r.method !== 'HEAD')

describe('авторизация по умолчанию', () => {
  it('открытыми помечены ровно маршруты из списка, остальные закрыты', () => {
    const marked = apiRoutes().filter((r) => r.config?.public).map((r) => `${r.method} ${r.url}`)
    expect(marked.sort()).toEqual([...PUBLIC].sort())
    // маршрутов с токеном заметно больше (защита от пустого списка из-за сбоя сбора)
    expect(apiRoutes().filter((r) => !r.config?.public).length).toBeGreaterThan(30)
  })

  it('каждый закрытый маршрут без токена отвечает 401 (даже с пустым телом, до проверки схемы)', async () => {
    const id = '00000000-0000-0000-0000-000000000001'
    for (const route of apiRoutes().filter((r) => !r.config?.public)) {
      const url = route.url.replace(/:messageId|:id|:memberId/g, id).replace(':chat', 'family').replace(':code', 'x')
      const res = await app.inject({ method: route.method as 'GET', url, payload: route.method === 'GET' || route.method === 'DELETE' ? undefined : {} })
      expect(res.statusCode, `${route.method} ${route.url}`).toBe(401)
    }
  })

  it('с неверным токеном и с токеном другого вида тоже 401', async () => {
    expect((await api(app, 'чужой-токен', 'GET', '/api/me')).status).toBe(401)
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: 'Basic abc' } })
    expect(res.statusCode).toBe(401)
  })

  it('неизвестный адрес под /api без токена тоже 401, а не 404: список маршрутов не прощупать', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/nope' })).statusCode).toBe(401)
  })
})

describe('срок жизни сессии', () => {
  it('сессия без использования дольше срока перестаёт работать, а чистка её удаляет', async () => {
    const { createSession } = await import('../../src/auth.js')
    const token = await createSession(pool, fam.kid.id)
    expect((await api(app, token, 'GET', '/api/me')).status).toBe(200)

    await pool.query(`update sessions set last_used_at = now() - make_interval(days => $2) where member_id = $1 and token_hash <> ''`, [fam.kid.id, SESSION_TTL_DAYS + 1])
    expect((await api(app, token, 'GET', '/api/me')).status).toBe(401)
    expect(await deleteExpiredSessions()).toBeGreaterThanOrEqual(1)
    // токен семьи из helpers тоже стал «старым» выше; остальных участников это не задело
    expect((await api(app, fam.mom.token, 'GET', '/api/me')).status).toBe(200)
  })

  it('пока токеном пользуются, срок продлевается (не чаще раза в сутки)', async () => {
    const token = fam.dad.token
    await pool.query(`update sessions set last_used_at = now() - interval '5 days' where member_id = $1`, [fam.dad.id])
    expect((await api(app, token, 'GET', '/api/me')).status).toBe(200)
    await new Promise((r) => setTimeout(r, 100))
    const { rows } = await pool.query(`select last_used_at > now() - interval '1 hour' as fresh from sessions where member_id = $1`, [fam.dad.id])
    expect(rows[0].fresh).toBe(true)
  })
})

describe('ошибки сервера', () => {
  it('внутренний текст ошибки клиенту не уходит', async () => {
    const original = pool.query.bind(pool)
    const spy = vi.spyOn(pool, 'query').mockImplementation(((...args: unknown[]) =>
      String(args[0]).includes('from members where family_id') && String(args[0]).includes('id <> $2')
        ? Promise.reject(new Error('секрет: relation "members" is broken'))
        : (original as (...a: unknown[]) => unknown)(...args)) as typeof pool.query)
    try {
      const res = await api(app, fam.mom.token, 'GET', '/api/chats')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'internal_error' })
    } finally {
      spy.mockRestore()
    }
  })

  it('ошибки клиента (проверка схемы) отдаются как раньше', async () => {
    const res = await api(app, fam.mom.token, 'GET', '/api/tasks/not-uuid')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('FST_ERR_VALIDATION')
  })
})
