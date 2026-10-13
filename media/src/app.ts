import { timingSafeEqual } from 'node:crypto'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Config } from './config.js'
import { InvalidImage, processImage } from './image.js'
import { verify } from './sign.js'
import type { BlobStore } from './store.js'

// Идентификаторы приходят от server (uuid); прочее в ключи не пускаем: так в адресе не бывает «..», слэшей и подмены префикса.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const keyOf = (family: string, id: string, variant: 'full' | 'thumb') => `${family}/${id}/${variant}.jpg`

const VARIANTS = new Set(['full', 'thumb'])

function sameToken(given: unknown, expected: string): boolean {
  if (typeof given !== 'string') return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface AppOptions {
  config: Config
  store: BlobStore
  // время параметром, чтобы срок подписи можно было проверить в тестах
  now?: () => Date
}

// Собирает приложение без запуска (как buildApp в server): index.ts только слушает порт.
export function buildApp({ config, store, now = () => new Date() }: AppOptions): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: config.maxUploadBytes,
    // проверку живости (раз в 30 секунд) в журнал не пишем
    disableRequestLogging: (req) => req.url === '/health',
  })

  // фото приходит сырым JPEG; остальные типы тела не принимаем
  app.addContentTypeParser('image/jpeg', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

  // проверка живости контейнера и самого хранилища (без секретов и данных)
  app.get('/health', async (_req, reply) => {
    try {
      await store.ping()
      return { ok: true }
    } catch {
      return reply.code(503).send({ ok: false })
    }
  })

  // ---- внутренний API для server (токен в заголовке; наружу через nginx не проксируется) ----
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/internal/')) return
    if (!sameToken(req.headers['x-internal-token'], config.internalToken)) return reply.code(401).send({ error: 'unauthorized' })
  })

  // Принять фото: проверить, перекодировать, сохранить полный вариант и превью. Повтор с тем же id перезаписывает файл.
  app.put<{ Params: { family: string; id: string }; Body: Buffer }>('/internal/media/:family/:id', async (req, reply) => {
    const { family, id } = req.params
    if (!UUID.test(family) || !UUID.test(id)) return reply.code(400).send({ error: 'invalid_id' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return reply.code(415).send({ error: 'invalid_image' })
    let processed
    try {
      processed = await processImage(req.body)
    } catch (err) {
      if (err instanceof InvalidImage) return reply.code(422).send({ error: 'invalid_image' })
      throw err
    }
    await store.put(keyOf(family, id, 'full'), processed.full, 'image/jpeg')
    await store.put(keyOf(family, id, 'thumb'), processed.thumb, 'image/jpeg')
    return { width: processed.width, height: processed.height, size: processed.full.length, thumbSize: processed.thumb.length }
  })

  // Удалить файл (повторный вызов безопасен).
  app.delete<{ Params: { family: string; id: string } }>('/internal/media/:family/:id', async (req, reply) => {
    const { family, id } = req.params
    if (!UUID.test(family) || !UUID.test(id)) return reply.code(400).send({ error: 'invalid_id' })
    await store.delete([keyOf(family, id, 'full'), keyOf(family, id, 'thumb')])
    return reply.code(204).send()
  })

  // Что лежит у семьи (для уборки сирот в server): идентификаторы и суммарный размер полных вариантов.
  app.get<{ Params: { family: string } }>('/internal/media/:family', async (req, reply) => {
    const { family } = req.params
    if (!UUID.test(family)) return reply.code(400).send({ error: 'invalid_id' })
    const objects = await store.list(`${family}/`)
    const items = new Map<string, number>()
    for (const o of objects) {
      const [, id, file] = o.key.split('/')
      if (!id) continue
      items.set(id, (items.get(id) ?? 0) + (file === 'full.jpg' ? o.size : 0))
    }
    return { items: [...items].map(([id, size]) => ({ id, size })) }
  })

  // Удалить всё у семьи (семья удалена).
  app.delete<{ Params: { family: string } }>('/internal/families/:family', async (req, reply) => {
    const { family } = req.params
    if (!UUID.test(family)) return reply.code(400).send({ error: 'invalid_id' })
    const objects = await store.list(`${family}/`)
    for (let i = 0; i < objects.length; i += 500) await store.delete(objects.slice(i, i + 500).map((o) => o.key))
    return reply.code(204).send()
  })

  // ---- раздача по подписанной ссылке ----
  // Без верной подписи, с чужим семейством или отсутствующим файлом ответ один и тот же (404): по ответу нельзя узнать, что есть.
  app.get<{ Params: { family: string; id: string; variant: string }; Querystring: { exp?: string; sig?: string } }>(
    '/media/:family/:id/:variant',
    async (req, reply) => {
      const { family, id, variant } = req.params
      const exp = Number(req.query.exp)
      const nowSeconds = Math.floor(now().getTime() / 1000)
      const ok =
        UUID.test(family) && UUID.test(id) && VARIANTS.has(variant) && typeof req.query.sig === 'string' &&
        verify(config.secret, family, id, exp, req.query.sig, nowSeconds)
      if (!ok) return reply.code(404).send({ error: 'not_found' })

      const object = await store.get(keyOf(family, id, variant as 'full' | 'thumb'))
      if (!object) {
        return reply.code(404).send({ error: 'not_found' })
      }
      // файл неизменяем (id уникален), кэшируем до конца действия подписи, но не дольше суток
      const maxAge = Math.max(0, Math.min(exp - nowSeconds, 86400))
      reply.header('Cache-Control', `private, max-age=${maxAge}`)
      reply.header('X-Content-Type-Options', 'nosniff')
      if (object.etag) {
        reply.header('ETag', object.etag)
        if (req.headers['if-none-match'] === object.etag) {
          object.body.destroy()
          return reply.code(304).send()
        }
      }
      reply.header('Content-Length', object.size)
      return reply.type('image/jpeg').send(object.body)
    },
  )

  return app
}
