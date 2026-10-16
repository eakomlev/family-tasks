import { timingSafeEqual } from 'node:crypto'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Config } from './config.js'
import { InvalidImage, processImage } from './image.js'
import { verify } from './sign.js'
import type { BlobStore } from './store.js'

// Идентификаторы приходят от server (uuid); прочее в ключи не пускаем: так в адресе не бывает «..», слэшей и подмены префикса.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const keyOf = (family: string, id: string, variant: 'full' | 'thumb') => `${family}/${id}/${variant}.jpg`
// обычный файл хранится как есть, одним объектом
export const fileKeyOf = (family: string, id: string) => `${family}/${id}/file`

const VARIANTS = new Set(['full', 'thumb', 'file'])

// Имя для скачивания приходит в запросе, поэтому берём только безопасное (без путей и управляющих знаков);
// для старых браузеров рядом запасное имя из ASCII.
export function contentDisposition(rawName: unknown): string {
  const cleaned = (typeof rawName === 'string' ? rawName : '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\\/"<>|:*?]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 150)
  const name = cleaned || 'file'
  const ascii = name.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

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
    // общий предел по большему из двух, у каждого маршрута записи свой точный
    bodyLimit: Math.max(config.maxUploadBytes, config.maxFileBytes),
    // проверку живости (раз в 30 секунд) в журнал не пишем
    disableRequestLogging: (req) => req.url === '/health',
  })

  // фото приходит сырым JPEG, файл сырыми байтами; остальные типы тела не принимаем
  app.addContentTypeParser('image/jpeg', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

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
  app.put<{ Params: { family: string; id: string }; Body: Buffer }>('/internal/media/:family/:id', { bodyLimit: config.maxUploadBytes }, async (req, reply) => {
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

  // Принять обычный файл (документ, архив…): байты сохраняются как есть, содержимое не разбирается. Что это за файл (имя, тип),
  // знает server; отсюда он отдаётся всегда как скачиваемый бинарный, а не как страница или картинка. Повтор с тем же id перезаписывает.
  app.put<{ Params: { family: string; id: string }; Body: Buffer }>('/internal/files/:family/:id', { bodyLimit: config.maxFileBytes }, async (req, reply) => {
    const { family, id } = req.params
    if (!UUID.test(family) || !UUID.test(id)) return reply.code(400).send({ error: 'invalid_id' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return reply.code(415).send({ error: 'invalid_file' })
    await store.put(fileKeyOf(family, id), req.body, 'application/octet-stream')
    return { size: req.body.length }
  })

  // Удалить фото или файл (повторный вызов безопасен): что лежит под этим id, знает server, поэтому убираем всё возможное.
  app.delete<{ Params: { family: string; id: string } }>('/internal/media/:family/:id', async (req, reply) => {
    const { family, id } = req.params
    if (!UUID.test(family) || !UUID.test(id)) return reply.code(400).send({ error: 'invalid_id' })
    await store.delete([keyOf(family, id, 'full'), keyOf(family, id, 'thumb'), fileKeyOf(family, id)])
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
      items.set(id, (items.get(id) ?? 0) + (file === 'full.jpg' || file === 'file' ? o.size : 0))
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
  app.get<{ Params: { family: string; id: string; variant: string }; Querystring: { exp?: string; sig?: string; name?: string } }>(
    '/media/:family/:id/:variant',
    async (req, reply) => {
      const { family, id, variant } = req.params
      const exp = Number(req.query.exp)
      const nowSeconds = Math.floor(now().getTime() / 1000)
      const ok =
        UUID.test(family) && UUID.test(id) && VARIANTS.has(variant) && typeof req.query.sig === 'string' &&
        verify(config.secret, family, id, exp, req.query.sig, nowSeconds)
      if (!ok) return reply.code(404).send({ error: 'not_found' })

      const isFile = variant === 'file'
      const object = await store.get(isFile ? fileKeyOf(family, id) : keyOf(family, id, variant as 'full' | 'thumb'))
      if (!object) {
        return reply.code(404).send({ error: 'not_found' })
      }
      // файл неизменяем (id уникален), кэшируем до конца действия подписи, но не дольше суток
      const maxAge = Math.max(0, Math.min(exp - nowSeconds, 86400))
      reply.header('Cache-Control', `private, max-age=${maxAge}`)
      reply.header('X-Content-Type-Options', 'nosniff')
      if (isFile) {
        // чужой файл никогда не открывается в приложении: только скачивание как бинарного, без выполнения чего-либо
        reply.header('Content-Disposition', contentDisposition(req.query.name))
        reply.header('Content-Security-Policy', "sandbox; default-src 'none'")
      }
      if (object.etag) {
        reply.header('ETag', object.etag)
        if (req.headers['if-none-match'] === object.etag) {
          object.body.destroy()
          return reply.code(304).send()
        }
      }
      reply.header('Content-Length', object.size)
      return reply.type(isFile ? 'application/octet-stream' : 'image/jpeg').send(object.body)
    },
  )

  return app
}
