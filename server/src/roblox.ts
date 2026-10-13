import dns from 'node:dns'
import https from 'node:https'
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

// Домен картинок (tr.rbxcdn.com) не резолвится у некоторых хостеров (например, у российских), хотя API Roblox доступен.
// Поэтому для скачивания картинки: сначала системный DNS, а если он не нашёл имя, публичные серверы.
const PUBLIC_DNS = ['1.1.1.1', '8.8.8.8']

type SystemLookup = (hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) => void
type Resolve4 = (hostname: string, callback: (err: NodeJS.ErrnoException | null, addresses?: string[]) => void) => void

export function createLookup(systemLookup: SystemLookup, resolve4: Resolve4) {
  return (hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) => {
    systemLookup(hostname, options, (err, address, family) => {
      if (!err) return callback(null, address, family)
      resolve4(hostname, (err2, addresses) => {
        if (err2 || !addresses?.length) return callback(err, '')
        // с options.all Node ждёт массив адресов
        if (options.all) return callback(null, addresses.map((a) => ({ address: a, family: 4 })))
        callback(null, addresses[0], 4)
      })
    })
  }
}

const publicResolver = new dns.Resolver({ timeout: 3000, tries: 1 })
publicResolver.setServers(PUBLIC_DNS)
const lookup = createLookup(dns.lookup as SystemLookup, (host, cb) => publicResolver.resolve4(host, cb))

// Скачивает картинку с CDN Roblox (адрес уже проверен: https и *.rbxcdn.com), не больше MAX_IMAGE_BYTES.
// Вынесено в объект, чтобы тесты подменяли скачивание, не ходя в сеть.
export const imageSource = {
  download(url: URL): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { lookup: lookup as never, timeout: TIMEOUT_MS }, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new RobloxError(`http_${res.statusCode}`))
        }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_IMAGE_BYTES) {
            req.destroy()
            reject(new RobloxError('bad_size'))
          } else chunks.push(chunk)
        })
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      req.on('timeout', () => req.destroy(new RobloxError('timeout')))
      req.on('error', reject)
    })
  },
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

  const bytes = await imageSource.download(url)
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
