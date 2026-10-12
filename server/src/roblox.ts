import type { FastifyInstance } from 'fastify'
import { authenticate } from './auth.js'

// Аватар из Roblox для ребёнка. Браузер напрямую к API Roblox не пойдёт (нет CORS), поэтому запросы делает сервер.
// Адреса фиксированы, из ответа берём только картинку с известного CDN: иначе сервер ходил бы по чужим адресам (SSRF).
const USERS_URL = 'https://users.roblox.com/v1/usernames/users'
const THUMBNAILS_URL = 'https://thumbnails.roblox.com/v1/users/avatar-headshot'
const CDN_SUFFIX = '.rbxcdn.com'
const TIMEOUT_MS = 8000
const MAX_IMAGE_BYTES = 300 * 1024

const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }

const bodySchema = {
  body: {
    type: 'object',
    required: ['username'],
    properties: { username: { type: 'string', minLength: 3, maxLength: 20, pattern: '^[A-Za-z0-9_]+$' } },
  },
} as const

class RobloxError extends Error {}

async function json(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new RobloxError(`http_${res.status}`)
  return res.json()
}

// Картинка аватара (data URL) по нику Roblox; null, если такого игрока нет.
export async function fetchRobloxAvatar(username: string): Promise<string | null> {
  const found = await json(USERS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  })
  const id = found?.data?.[0]?.id
  if (!Number.isSafeInteger(id)) return null

  const thumb = await json(`${THUMBNAILS_URL}?userIds=${id}&size=150x150&format=Png&isCircular=false`)
  const imageUrl: unknown = thumb?.data?.[0]?.imageUrl
  if (typeof imageUrl !== 'string') throw new RobloxError('no_image')
  const url = new URL(imageUrl)
  if (url.protocol !== 'https:' || !url.hostname.endsWith(CDN_SUFFIX)) throw new RobloxError('bad_host')

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new RobloxError(`http_${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new RobloxError('bad_size')
  return `data:image/png;base64,${bytes.toString('base64')}`
}

export async function robloxRoutes(app: FastifyInstance) {
  // Ребёнок вводит ник Roblox и получает картинку аватара (клиент сам обрежет её и сохранит в профиль).
  app.post<{ Body: { username: string } }>('/api/me/roblox-avatar', { schema: bodySchema, config: strictLimit }, async (req, reply) => {
    const member = await authenticate(req)
    if (!member) return reply.code(401).send({ error: 'unauthorized' })
    if (member.role !== 'child') return reply.code(403).send({ error: 'children_only' })

    try {
      const image = await fetchRobloxAvatar(req.body.username)
      if (!image) return reply.code(404).send({ error: 'roblox_user_not_found' })
      return { image }
    } catch (err) {
      req.log.warn({ err }, 'roblox недоступен')
      return reply.code(502).send({ error: 'roblox_unavailable' })
    }
  })
}
