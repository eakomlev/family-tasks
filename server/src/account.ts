import type { FastifyInstance } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import { eventChatKey } from './chatKey.js'
import type { MediaClient } from './media/client.js'
import { publish, publishTo } from './realtime.js'
import { isAdult } from './roles.js'

interface Options {
  media: { client: MediaClient; secret: string } | null
}

// Условие «личный чат с этим участником» по ключу `a:b` (ключи общего чата и событий в нём не совпадают с uuid участника)
const direct = (column: string) => `(split_part(${column}, ':', 1) = $1::text or split_part(${column}, ':', 2) = $1::text)`

// Удаление собственного аккаунта. Ребёнок и создатель семьи не могут: у создателя есть только удаление всей семьи.
// Вместе с участником удаляется всё, что с ним связано: его сообщения, личные чаты целиком (в том числе чужие сообщения в них),
// чаты созданных им событий, задания, цели, игры, подписки и сессии. Файлы чатов убираются из хранилища после фиксации.
export async function accountRoutes(app: FastifyInstance, { media }: Options) {
  app.delete('/api/me', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const member = await authenticate(req)
    if (!member) return reply.code(401).send({ error: 'unauthorized' })
    if (!isAdult(member.role)) return reply.code(403).send({ error: 'children_cannot_delete' })
    if (member.is_owner) return reply.code(403).send({ error: 'owner_cannot_delete' })

    const db = await pool.connect()
    let fileIds: string[] = []
    let others: string[] = []
    try {
      await db.query('begin')
      // блокируем участника: параллельные удаления и входы не пересекутся
      const locked = await db.query('select 1 from members where id = $1 and family_id = $2 and is_owner = false for update', [member.id, member.family_id])
      if (!locked.rows[0]) {
        await db.query('rollback')
        return reply.code(404).send({ error: 'not_found' })
      }
      const events = await db.query<{ id: string }>('select id from events where author_id = $1', [member.id])
      const eventKeys = events.rows.map((e) => eventChatKey(e.id))

      // файлы: загруженные участником и вложения в чужих сообщениях личных чатов и чатов его событий
      const files = await db.query<{ id: string }>(
        `select id from media where uploader_id = $1
         union
         select mm.media_id from message_media mm join messages m on m.id = mm.message_id
         where m.family_id = $2 and (${direct('m.chat_key')} or m.chat_key = any($3))`,
        [member.id, member.family_id, eventKeys],
      )
      fileIds = files.rows.map((f) => f.id)

      await db.query(`delete from messages where family_id = $2 and (${direct('chat_key')} or chat_key = any($3))`, [member.id, member.family_id, eventKeys])
      if (fileIds.length > 0) await db.query('delete from media where id = any($1)', [fileIds])
      for (const table of ['chat_reads', 'chat_mutes', 'chat_archives', 'chat_visits']) {
        await db.query(`delete from ${table} where ${direct('chat_key')} or chat_key = any($2)`, [member.id, eventKeys])
      }
      const people = await db.query<{ id: string }>('select id from members where family_id = $1 and id <> $2', [member.family_id, member.id])
      others = people.rows.map((p) => p.id)
      // остальное связано с участником каскадом (задания, цели, монеты, игры, события, сессии, подписки)
      await db.query('delete from members where id = $1', [member.id])
      await db.query('commit')
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }

    // файлы убираем после фиксации; недоступное хранилище оставляет файл без записи, это лишь занятое место
    if (media) {
      for (const id of fileIds) {
        try {
          await media.client.delete(member.family_id, id)
        } catch (err) {
          req.log.warn(err)
        }
      }
    }
    // остальные участники обновят всё, что могло измениться
    for (const event of ['members', 'tasks', 'events', 'games'] as const) {
      publish(member.family_id, { type: event })
    }
    for (const id of others) publishTo(id, { type: 'chat', chat: member.id })
    return reply.code(204).send()
  })
}
