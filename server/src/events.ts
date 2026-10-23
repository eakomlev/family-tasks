import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import { eventChatId, eventChatKey } from './chatKey.js'
import type { MediaClient } from './media/client.js'
import { publish, publishTo } from './realtime.js'
import { isRealDate } from './tasks/recurrence.js'

// Семейный календарь: события с датами, необязательным временем и участниками.
// Видимость: событие видят автор и участники; «вся семья» видят все. Менять и удалять может только автор.
// У каждого события есть чат (его ведёт `chat.ts`, адрес `event-<id>`): участники те же, что видят событие. При удалении события чат уходит с ним.

// не больше дней в одном запросе списка (месяц с запасом на соседние недели)
const MAX_RANGE_DAYS = 100
const MAX_MEMBERS = 12

const time = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' } as const
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const
const idParams = { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }

const eventBody = {
  type: 'object',
  required: ['title', 'startDate', 'endDate'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    startDate: date,
    endDate: date,
    startTime: { anyOf: [time, { type: 'null' }] },
    endTime: { anyOf: [time, { type: 'null' }] },
    allFamily: { type: 'boolean' },
    memberIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: MAX_MEMBERS, uniqueItems: true },
  },
}

const listQuery = {
  type: 'object',
  required: ['from', 'to'],
  properties: { from: date, to: date },
}

interface EventInput {
  title: string
  startDate: string
  endDate: string
  startTime?: string | null
  endTime?: string | null
  allFamily?: boolean
  memberIds?: string[]
}

export interface EventDto {
  id: string
  title: string
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  allFamily: boolean
  // участники (у события «вся семья» пусто)
  memberIds: string[]
  authorId: string
  createdAt: string
}

const COLUMNS = `e.id, e.title, to_char(e.start_date, 'YYYY-MM-DD') as "startDate", to_char(e.end_date, 'YYYY-MM-DD') as "endDate",
  to_char(e.start_time, 'HH24:MI') as "startTime", to_char(e.end_time, 'HH24:MI') as "endTime",
  e.all_family as "allFamily", e.author_id as "authorId", e.created_at as "createdAt",
  coalesce((select json_agg(em.member_id order by em.member_id) from event_members em where em.event_id = e.id), '[]'::json) as "memberIds"`

// условие видимости: $N это id участника
const visible = (param: number) =>
  `(e.all_family or e.author_id = $${param} or exists (select 1 from event_members em where em.event_id = e.id and em.member_id = $${param}))`

// Проверка тела: настоящие даты, время парой, конец не раньше начала. Возвращает код ошибки или null.
function validate(body: EventInput): string | null {
  if (!isRealDate(body.startDate) || !isRealDate(body.endDate)) return 'invalid_date'
  if (body.startDate < '2000-01-01' || body.endDate > '2100-12-31') return 'invalid_date'
  if (body.endDate < body.startDate) return 'invalid_range'
  const hasStart = body.startTime != null
  const hasEnd = body.endTime != null
  if (hasStart !== hasEnd) return 'invalid_time'
  if (hasStart && body.startDate === body.endDate && body.endTime! <= body.startTime!) return 'invalid_time'
  return null
}

export interface EventOptions {
  // файлы из чата события убираются из хранилища вместе с событием; null: фото не настроены
  media: { client: MediaClient; secret: string } | null
}

export async function eventRoutes(app: FastifyInstance, { media = null }: Partial<EventOptions> = {}) {
  async function me(req: FastifyRequest, reply: FastifyReply) {
    const member = await authenticate(req)
    if (!member) reply.code(401).send({ error: 'unauthorized' })
    return member
  }

  async function load(id: string, memberId: string, familyId: string): Promise<EventDto | undefined> {
    const { rows } = await pool.query<EventDto>(`select ${COLUMNS} from events e where e.id = $1 and e.family_id = $2 and ${visible(3)}`, [id, familyId, memberId])
    return rows[0]
  }

  // Участники должны быть из этой же семьи; возвращает уникальные id или null, если кто-то чужой.
  async function checkMembers(ids: string[], familyId: string): Promise<string[] | null> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return unique
    const { rows } = await pool.query('select id from members where family_id = $1 and id = any($2)', [familyId, unique])
    return rows.length === unique.length ? unique : null
  }

  // Кому видно событие (и значит, кто участвует в его чате): автор, участники или вся семья
  async function participantsOf(eventId: string, familyId: string): Promise<string[]> {
    const { rows } = await pool.query<{ id: string }>(
      `select m.id from members m join events e on e.id = $1 and e.family_id = m.family_id
       where m.family_id = $2 and (e.all_family or m.id = e.author_id or exists (select 1 from event_members em where em.event_id = e.id and em.member_id = m.id))`,
      [eventId, familyId],
    )
    return rows.map((r) => r.id)
  }

  // Состав участников или название изменились: чат события появится или пропадёт в списке у этих людей (старым и новым)
  function signalChat(eventId: string, ...groups: string[][]) {
    for (const id of new Set(groups.flat())) publishTo(id, { type: 'chat', chat: eventChatId(eventId) })
  }

  // События периода, видимые вошедшему (пересекающие период хотя бы днём)
  app.get<{ Querystring: { from: string; to: string } }>('/api/events', { schema: { querystring: listQuery } }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const { from, to } = req.query
    if (!isRealDate(from) || !isRealDate(to) || to < from) return reply.code(400).send({ error: 'invalid_range' })
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_RANGE_DAYS) return reply.code(400).send({ error: 'range_too_long' })
    const { rows } = await pool.query<EventDto>(
      `select ${COLUMNS} from events e
       where e.family_id = $1 and e.start_date <= $3 and e.end_date >= $2 and ${visible(4)}
       order by e.start_date, e.start_time nulls first, e.created_at`,
      [member.family_id, from, to, member.id],
    )
    return { events: rows }
  })

  app.get<{ Params: { id: string } }>('/api/events/:id', { schema: { params: idParams } }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const event = await load(req.params.id, member.id, member.family_id)
    if (!event) return reply.code(404).send({ error: 'event_not_found' })
    return { event }
  })

  app.post<{ Body: EventInput }>('/api/events', { schema: { body: eventBody } }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const problem = validate(req.body)
    if (problem) return reply.code(400).send({ error: problem })
    const allFamily = req.body.allFamily === true
    const memberIds = allFamily ? [] : await checkMembers(req.body.memberIds ?? [], member.family_id)
    if (!memberIds) return reply.code(400).send({ error: 'invalid_members' })

    const db = await pool.connect()
    let id: string
    try {
      await db.query('begin')
      const { rows } = await db.query<{ id: string }>(
        `insert into events (family_id, author_id, title, start_date, end_date, start_time, end_time, all_family)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [member.family_id, member.id, req.body.title.trim(), req.body.startDate, req.body.endDate, req.body.startTime ?? null, req.body.endTime ?? null, allFamily],
      )
      id = rows[0].id
      for (const memberId of memberIds) await db.query('insert into event_members (event_id, member_id) values ($1, $2)', [id, memberId])
      await db.query('commit')
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }
    publish(member.family_id, { type: 'events' })
    return reply.code(201).send({ event: await load(id, member.id, member.family_id) })
  })

  app.put<{ Params: { id: string }; Body: EventInput }>('/api/events/:id', { schema: { params: idParams, body: eventBody } }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const existing = await load(req.params.id, member.id, member.family_id)
    if (!existing) return reply.code(404).send({ error: 'event_not_found' })
    if (existing.authorId !== member.id) return reply.code(403).send({ error: 'forbidden' })
    const problem = validate(req.body)
    if (problem) return reply.code(400).send({ error: problem })
    const allFamily = req.body.allFamily === true
    const memberIds = allFamily ? [] : await checkMembers(req.body.memberIds ?? [], member.family_id)
    if (!memberIds) return reply.code(400).send({ error: 'invalid_members' })

    const before = await participantsOf(existing.id, member.family_id)
    const db = await pool.connect()
    try {
      await db.query('begin')
      await db.query(
        `update events set title = $2, start_date = $3, end_date = $4, start_time = $5, end_time = $6, all_family = $7 where id = $1`,
        [existing.id, req.body.title.trim(), req.body.startDate, req.body.endDate, req.body.startTime ?? null, req.body.endTime ?? null, allFamily],
      )
      await db.query('delete from event_members where event_id = $1', [existing.id])
      for (const memberId of memberIds) await db.query('insert into event_members (event_id, member_id) values ($1, $2)', [existing.id, memberId])
      await db.query('commit')
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }
    publish(member.family_id, { type: 'events' })
    signalChat(existing.id, before, await participantsOf(existing.id, member.family_id))
    return { event: await load(existing.id, member.id, member.family_id) }
  })

  app.delete<{ Params: { id: string } }>('/api/events/:id', { schema: { params: idParams } }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const existing = await load(req.params.id, member.id, member.family_id)
    if (!existing) return reply.code(404).send({ error: 'event_not_found' })
    if (existing.authorId !== member.id) return reply.code(403).send({ error: 'forbidden' })
    const people = await participantsOf(existing.id, member.family_id)
    // чат события удаляется вместе с ним: сообщения, их фото и файлы (реакции пропадают каскадом, монеты остаются)
    const db = await pool.connect()
    let files: { id: string }[]
    try {
      await db.query('begin')
      const { rows } = await db.query<{ id: string }>(
        'select mm.media_id as id from message_media mm join messages m on m.id = mm.message_id where m.family_id = $1 and m.chat_key = $2',
        [member.family_id, eventChatKey(existing.id)],
      )
      files = rows
      await db.query('delete from messages where family_id = $1 and chat_key = $2', [member.family_id, eventChatKey(existing.id)])
      if (files.length > 0) await db.query('delete from media where id = any($1)', [files.map((f) => f.id)])
      await db.query('delete from chat_reads where chat_key = $1', [eventChatKey(existing.id)])
      await db.query('delete from chat_mutes where chat_key = $1', [eventChatKey(existing.id)])
      await db.query('delete from chat_archives where chat_key = $1', [eventChatKey(existing.id)])
      await db.query('delete from events where id = $1', [existing.id])
      await db.query('commit')
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }
    // файлы убираем после фиксации; недоступное хранилище оставляет файл без записи, это лишь занятое место
    if (media) {
      for (const f of files) {
        try {
          await media.client.delete(member.family_id, f.id)
        } catch (err) {
          req.log.warn(err)
        }
      }
    }
    publish(member.family_id, { type: 'events' })
    signalChat(existing.id, people)
    return reply.code(204).send()
  })
}
