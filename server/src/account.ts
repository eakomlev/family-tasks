import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import { eventChatKey } from './chatKey.js'
import type { MediaClient } from './media/client.js'
import { closeSessionHash, publish, publishTo } from './realtime.js'
import { isAdult, type Role } from './roles.js'

interface Options {
  media: { client: MediaClient; secret: string } | null
}

// Условие «личный чат с этим участником» по ключу `a:b` (ключи общего чата и событий в нём не совпадают с uuid участника)
const direct = (column: string) => `(split_part(${column}, ':', 1) = $1::text or split_part(${column}, ':', 2) = $1::text)`

interface Target {
  id: string
  family_id: string | null
  role?: string
}
type FamilyTarget = Target & { family_id: string }

interface ErasedMember { fileIds: string[]; others: string[]; sessionHashes: string[] }

// Стирает участника вместе с тем, что с ним связано: его сообщения, личные чаты целиком (в том числе чужие сообщения в них),
// чаты созданных им событий, задания, цели, игры, подписки и сессии. Создателя семьи не трогает (null). Файлы чатов убираются из хранилища
// отдельно, после фиксации (finishErase).
async function eraseMember(target: FamilyTarget, detach = false): Promise<ErasedMember | null> {
  const db = await pool.connect()
  try {
    await db.query('begin')
    // блокируем участника: параллельные удаления и входы не пересекутся
    const locked = await db.query('select 1 from members where id = $1 and family_id = $2 and is_owner = false for update', [target.id, target.family_id])
    if (!locked.rows[0]) {
      await db.query('rollback')
      return null
    }
    const events = await db.query<{ id: string }>('select id from events where author_id = $1', [target.id])
    const eventKeys = events.rows.map((e) => eventChatKey(e.id))
    const sessions = await db.query<{ token_hash: string }>('select token_hash from sessions where member_id = $1', [target.id])

    // файлы: загруженные участником и вложения в чужих сообщениях личных чатов и чатов его событий
    const files = await db.query<{ id: string }>(
      `select id from media where uploader_id = $1
       union
       select mm.media_id from message_media mm join messages m on m.id = mm.message_id
       where m.family_id = $2 and (${direct('m.chat_key')} or m.chat_key = any($3))`,
      [target.id, target.family_id, eventKeys],
    )
    const fileIds = files.rows.map((f) => f.id)

    await db.query(`delete from messages where family_id = $2 and (${direct('chat_key')} or chat_key = any($3))`, [target.id, target.family_id, eventKeys])
    if (fileIds.length > 0) await db.query('delete from media where id = any($1)', [fileIds])
    for (const table of ['chat_reads', 'chat_mutes', 'chat_archives', 'chat_visits']) {
      await db.query(`delete from ${table} where ${direct('chat_key')} or chat_key = any($2)`, [target.id, eventKeys])
    }
    const people = await db.query<{ id: string }>('select id from members where family_id = $1 and id <> $2', [target.family_id, target.id])
    // Взрослого убирают из семьи, но аккаунт оставляют: копия без семьи получает его сессии и подписки на push (вход не слетает, приложение
    // само уведёт его на страницу «Создать семью или присоединиться»), а старая запись удаляется и вместе с ней каскадом всё семейное
    // (задания, цели, монеты, игры, события). Если этот контакт есть и в другой семье, копию не делаем: та запись остаётся, а эта просто удаляется.
    if (detach) {
      const { rows } = await db.query(
        `insert into members (family_id, name, email, phone, role, avatar, birth_date, consent_version, consent_at)
         select null, m.name, m.email, m.phone, m.role, m.avatar, m.birth_date, m.consent_version, m.consent_at from members m
         where m.id = $1
           and not exists (select 1 from members o where o.id <> m.id and ((m.email is not null and o.email = m.email) or (m.phone is not null and o.phone = m.phone)))
         returning id`,
        [target.id],
      )
      const copy = rows[0]?.id as string | undefined
      if (copy) {
        await db.query('update sessions set member_id = $1 where member_id = $2', [copy, target.id])
        await db.query('update push_subscriptions set member_id = $1 where member_id = $2', [copy, target.id])
      }
    }
    // остальное связано с участником каскадом (задания, цели, монеты, игры, события, сессии, подписки)
    await db.query('delete from members where id = $1', [target.id])
    await db.query('commit')
    return { fileIds, others: people.rows.map((p) => p.id), sessionHashes: detach ? [] : sessions.rows.map((s) => s.token_hash) }
  } catch (err) {
    await db.query('rollback').catch(() => {})
    throw err
  } finally {
    db.release()
  }
}

// После фиксации: файлы убираем из хранилища (недоступное хранилище оставляет файл без записи, это лишь занятое место),
// остальным участникам уходят сигналы обновиться
async function finishErase(req: FastifyRequest, media: Options['media'], target: FamilyTarget, erased: ErasedMember) {
  for (const sessionHash of erased.sessionHashes) closeSessionHash(sessionHash)
  if (media) {
    for (const id of erased.fileIds) {
      try {
        await media.client.delete(target.family_id, id)
      } catch (err) {
        req.log.warn(err)
      }
    }
  }
  for (const event of ['members', 'tasks', 'events', 'games'] as const) {
    publish(target.family_id, { type: event })
  }
  for (const id of erased.others) publishTo(id, { type: 'chat', chat: target.id })
}

// Административное удаление отдельного участника; создатель удаляется вместе со всей семьёй через family_deletions.
export async function deleteAdminMember(req: FastifyRequest, media: Options['media'], memberId: string): Promise<'deleted' | 'not_found' | 'owner'> {
  const { rows } = await pool.query<Target & { is_owner: boolean; family_id: string | null }>(
    'select id, family_id, role, is_owner from members where id = $1', [memberId],
  )
  const target = rows[0]
  if (!target) return 'not_found'
  if (target.is_owner) return 'owner'

  if (target.family_id === null) {
    const db = await pool.connect()
    let sessionHashes: string[] = []
    try {
      await db.query('begin')
      const locked = await db.query('select 1 from members where id = $1 and family_id is null and is_owner = false for update', [memberId])
      if (!locked.rows[0]) { await db.query('rollback'); return 'not_found' }
      const sessions = await db.query<{ token_hash: string }>('select token_hash from sessions where member_id = $1', [memberId])
      sessionHashes = sessions.rows.map((session) => session.token_hash)
      await db.query('delete from members where id = $1', [memberId])
      await db.query('commit')
    } catch (error) {
      await db.query('rollback').catch(() => {})
      throw error
    } finally {
      db.release()
    }
    for (const sessionHash of sessionHashes) closeSessionHash(sessionHash)
    return 'deleted'
  }

  const erased = await eraseMember({ ...target, family_id: target.family_id })
  if (!erased) return 'not_found'
  await finishErase(req, media, { ...target, family_id: target.family_id }, erased)
  return 'deleted'
}

// Удаление аккаунта. Свой: ребёнок и создатель семьи не могут (у создателя есть только удаление всей семьи).
// Чужой: `DELETE /api/members/:id`, только создатель семьи, взрослого он убирает из семьи, ребёнка удаляет; оба случая стирают участника так же, как `DELETE /api/me`.
export async function accountRoutes(app: FastifyInstance, { media }: Options) {
  app.delete('/api/me', { config: { detached: true, rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const member = await authenticate(req)
    if (!member) return reply.code(401).send({ error: 'unauthorized' })
    if (!isAdult(member.role)) return reply.code(403).send({ error: 'children_cannot_delete' })
    if (member.is_owner) return reply.code(403).send({ error: 'owner_cannot_delete' })

    // без семьи стирать нечего, кроме самой записи (сессии и подписки уходят каскадом)
    if (member.family_id === null) {
      await pool.query('delete from members where id = $1', [member.id])
      return reply.code(204).send()
    }

    const erased = await eraseMember({ ...member, family_id: member.family_id })
    if (!erased) return reply.code(404).send({ error: 'not_found' })
    await finishErase(req, media, member, erased)
    return reply.code(204).send()
  })

  app.delete<{ Params: { id: string } }>('/api/members/:id', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const member = await authenticate(req)
    if (!member) return reply.code(401).send({ error: 'unauthorized' })
    if (!member.is_owner) return reply.code(403).send({ error: 'owner_only' })
    if (req.params.id === member.id) return reply.code(400).send({ error: 'cannot_remove_owner' })

    const found = await pool.query<Target>('select id, family_id, role from members where id::text = $1 and family_id = $2', [req.params.id, member.family_id])
    const target = found.rows[0]
    if (!target || target.family_id === null) return reply.code(404).send({ error: 'member_not_found' })

    // взрослого убираем из семьи с сохранением аккаунта, ребёнка удаляем полностью
    const erased = await eraseMember({ ...target, family_id: target.family_id }, isAdult(target.role as Role))
    if (!erased) return reply.code(404).send({ error: 'member_not_found' })
    await finishErase(req, media, { ...target, family_id: target.family_id }, erased)
    return reply.code(204).send()
  })
}
