import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from './auth.js'
import { pool } from './db.js'
import type { PushMessage } from './notifications/messages.js'
import { notifyMember } from './push.js'
import { publishTo } from './realtime.js'

const MAX_TEXT = 2000
const PAGE_SIZE = 50
const PREVIEW_LENGTH = 140

export const FAMILY_CHAT = 'family'

// Ключ личного чата: id обоих участников по возрастанию, поэтому у собеседников он одинаковый.
export const directKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`)

const chatParams = {
  type: 'object',
  required: ['chat'],
  properties: { chat: { type: 'string', pattern: '^(family|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' } },
}
const listMessagesSchema = {
  params: chatParams,
  querystring: {
    type: 'object',
    properties: {
      before: { type: 'string', format: 'uuid' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: PAGE_SIZE },
    },
  },
}
const sendSchema = {
  params: chatParams,
  body: {
    type: 'object',
    required: ['text'],
    additionalProperties: false,
    properties: { text: { type: 'string', minLength: 1, maxLength: MAX_TEXT + 2000 } },
  },
}

interface Member {
  id: string
  name: string
  family_id: string
  created_at: Date
}

interface Chat {
  // для запросов: ключ в таблице сообщений
  key: string
  // кто участвует (для рассылки)
  participants: string[]
  // собеседник для личного чата, null для общего
  otherId: string | null
}

interface MessageRow {
  id: string
  senderId: string
  text: string
  createdAt: string
}

const toMessage = (row: MessageRow) => ({ id: row.id, senderId: row.senderId, text: row.text, createdAt: row.createdAt })

// «Имя · Общий чат» для общего чата, просто имя для личного. Текст сжат до одной строки.
export function chatPushMessage(senderName: string, chatId: string, text: string): PushMessage {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  const body = oneLine.length > PREVIEW_LENGTH ? `${oneLine.slice(0, PREVIEW_LENGTH - 1)}…` : oneLine
  return {
    title: chatId === FAMILY_CHAT ? `${senderName} · Общий чат` : senderName,
    body,
    url: `/chat/${chatId}`,
    tag: `chat-${chatId}`,
  }
}

export async function chatRoutes(app: FastifyInstance) {
  async function me(req: FastifyRequest, reply: FastifyReply): Promise<Member | null> {
    const member = await authenticate(req)
    if (!member) {
      reply.code(401).send({ error: 'unauthorized' })
      return null
    }
    return member
  }

  // Чат из адреса: «family» или id собеседника из той же семьи. Иначе ответ уже отправлен и вернётся null.
  async function resolveChat(member: Member, chat: string, reply: FastifyReply): Promise<Chat | null> {
    if (chat === FAMILY_CHAT) {
      const { rows } = await pool.query('select id from members where family_id = $1', [member.family_id])
      return { key: FAMILY_CHAT, participants: rows.map((r) => r.id as string), otherId: null }
    }
    if (chat === member.id) {
      reply.code(400).send({ error: 'invalid_chat' })
      return null
    }
    const { rows } = await pool.query('select id from members where id = $1 and family_id = $2', [chat, member.family_id])
    if (!rows[0]) {
      reply.code(404).send({ error: 'chat_not_found' })
      return null
    }
    return { key: directKey(member.id, chat), participants: [member.id, chat], otherId: chat }
  }

  // Список чатов: общий и по одному с каждым участником, свежая активность выше.
  // Чаты без сообщений идут в конце: сначала общий, затем по имени.
  app.get('/api/chats', async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return

    const { rows: others } = await pool.query(
      'select id, name from members where family_id = $1 and id <> $2 order by lower(name)',
      [member.family_id, member.id],
    )
    const chats = [
      { id: FAMILY_CHAT, key: FAMILY_CHAT },
      ...others.map((o) => ({ id: o.id as string, key: directKey(member.id, o.id) })),
    ]
    const keys = chats.map((c) => c.key)

    const { rows: lasts } = await pool.query<MessageRow & { chatKey: string }>(
      `select distinct on (chat_key) chat_key as "chatKey", id, sender_id as "senderId", text, created_at as "createdAt"
       from messages where family_id = $1 and chat_key = any($2)
       order by chat_key, created_at desc, id desc`,
      [member.family_id, keys],
    )
    const { rows: unreads } = await pool.query<{ chatKey: string; count: string }>(
      `select m.chat_key as "chatKey", count(*) as count
       from messages m left join chat_reads r on r.member_id = $2 and r.chat_key = m.chat_key
       where m.family_id = $1 and m.chat_key = any($3) and m.sender_id <> $2
         and m.created_at > coalesce(r.last_read_at, $4)
       group by m.chat_key`,
      [member.family_id, member.id, keys, member.created_at],
    )
    const lastBy = new Map(lasts.map((l) => [l.chatKey, l]))
    const unreadBy = new Map(unreads.map((u) => [u.chatKey, Number(u.count)]))

    const list = chats.map((c) => {
      const last = lastBy.get(c.key)
      return { id: c.id, last: last ? toMessage(last) : null, unread: unreadBy.get(c.key) ?? 0 }
    })
    // порядок по времени последнего сообщения; без сообщений: порядок исходного списка (общий, затем по имени)
    const order = new Map(list.map((c, i) => [c.id, i]))
    list.sort((a, b) => {
      if (a.last && b.last) return a.last.createdAt < b.last.createdAt ? 1 : a.last.createdAt > b.last.createdAt ? -1 : 0
      if (a.last) return -1
      if (b.last) return 1
      return order.get(a.id)! - order.get(b.id)!
    })
    return { chats: list }
  })

  // Сообщения чата, старые сверху. Без before отдаются самые свежие; before = id самого старого уже загруженного.
  app.get<{ Params: { chat: string }; Querystring: { before?: string; limit?: number } }>(
    '/api/chats/:chat/messages',
    { schema: listMessagesSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return

      const limit = req.query.limit ?? PAGE_SIZE
      const { rows } = await pool.query<MessageRow>(
        `select id, sender_id as "senderId", text, created_at as "createdAt"
         from messages
         where family_id = $1 and chat_key = $2
           and ($3::uuid is null or (created_at, id) < (select created_at, id from messages where id = $3 and chat_key = $2))
         order by created_at desc, id desc limit $4`,
        [member.family_id, chat.key, req.query.before ?? null, limit + 1],
      )
      const hasMore = rows.length > limit

      // До какого момента прочитали остальные участники чата: свои сообщения не позже этого времени отмечаются как прочитанные.
      // В общем чате это самый «отстающий» участник (прочитали все), у тех, кто чат не открывал, отсчёт с момента появления в семье.
      const peers = chat.participants.filter((id) => id !== member.id)
      const { rows: read } = await pool.query(
        `select min(coalesce(r.last_read_at, m.created_at)) as "readUpTo"
         from members m left join chat_reads r on r.member_id = m.id and r.chat_key = $1
         where m.id = any($2)`,
        [chat.key, peers],
      )
      return { messages: rows.slice(0, limit).reverse().map(toMessage), hasMore, readUpTo: (read[0]?.readUpTo as string | null) ?? null }
    },
  )

  app.post<{ Params: { chat: string }; Body: { text: string } }>(
    '/api/chats/:chat/messages',
    { schema: sendSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return

      const text = req.body.text.trim()
      if (text.length === 0 || text.length > MAX_TEXT) return reply.code(400).send({ error: 'invalid_text' })

      const { rows } = await pool.query<MessageRow>(
        `insert into messages (family_id, chat_key, sender_id, text) values ($1, $2, $3, $4)
         returning id, sender_id as "senderId", text, created_at as "createdAt"`,
        [member.family_id, chat.key, member.id, text],
      )
      const message = toMessage(rows[0])
      // своё сообщение читать не нужно
      await pool.query(
        `insert into chat_reads (member_id, chat_key, last_read_at) values ($1, $2, $3)
         on conflict (member_id, chat_key) do update set last_read_at = excluded.last_read_at`,
        [member.id, chat.key, message.createdAt],
      )

      // каждому участнику (и другим устройствам автора) сигнал с чатом, каким он виден ему: общий или собеседник
      for (const id of chat.participants) {
        const view = chat.otherId === null ? FAMILY_CHAT : id === member.id ? chat.otherId : member.id
        publishTo(id, { type: 'chat', chat: view })
        if (id !== member.id) void notifyMember(id, chatPushMessage(member.name, view, text))
      }
      return reply.code(201).send({ message })
    },
  )

  // Отметить чат прочитанным до этого момента.
  app.post<{ Params: { chat: string } }>('/api/chats/:chat/read', { schema: { params: chatParams } }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const chat = await resolveChat(member, req.params.chat, reply)
    if (!chat) return

    // сигнал другим устройствам нужен, только если что-то было непрочитано; иначе открытая переписка зациклилась бы на собственных отметках
    const { rows } = await pool.query(
      `select 1 from messages m left join chat_reads r on r.member_id = $2 and r.chat_key = m.chat_key
       where m.family_id = $1 and m.chat_key = $3 and m.sender_id <> $2 and m.created_at > coalesce(r.last_read_at, $4) limit 1`,
      [member.family_id, member.id, chat.key, member.created_at],
    )
    await pool.query(
      `insert into chat_reads (member_id, chat_key, last_read_at) values ($1, $2, now())
       on conflict (member_id, chat_key) do update set last_read_at = greatest(chat_reads.last_read_at, excluded.last_read_at)`,
      [member.id, chat.key],
    )
    if (rows.length > 0) {
      // счётчик на других устройствах этого же участника
      publishTo(member.id, { type: 'chat', chat: req.params.chat })
      // собеседники видят, что прочитано (галочки у их сообщений)
      for (const id of chat.participants) {
        if (id !== member.id) publishTo(id, { type: 'chat', chat: chat.otherId === null ? FAMILY_CHAT : member.id })
      }
    }
    return reply.code(204).send()
  })
}
