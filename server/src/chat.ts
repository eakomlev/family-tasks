import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { authenticate } from './auth.js'
import { directKey } from './chatKey.js'
import { MediaRejected, type MediaClient } from './media/client.js'
import { loadMedia, MAX_PHOTO_BYTES, MAX_PHOTOS, mediaQuotaBytes, photoPlaceholder, type MediaDto } from './media/index.js'
import { pool } from './db.js'
import type { PushMessage } from './outbox/contract.js'
import { coinsWord } from './tasks/text.js'
import { enqueueToMember } from './outbox/index.js'
import { isViewingChat, publish, publishTo } from './realtime.js'

const MAX_TEXT = 2000

// Реакции, которые участник может поставить на сообщение (тот же список на клиенте, lib/reactions.ts).
export const REACTIONS = ['👍', '❤️', '🔥', '👏', '🎉', '💪', '🤩', '😍']
const MAX_AWARD = 1000
const PAGE_SIZE = 50
const PREVIEW_LENGTH = 140

export const FAMILY_CHAT = 'family'

export { directKey }

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
    additionalProperties: false,
    properties: {
      text: { type: 'string', maxLength: MAX_TEXT + 2000 },
      // фото, загруженные через POST /api/chats/:chat/media, в порядке показа
      mediaIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: MAX_PHOTOS, uniqueItems: true },
    },
  },
}

interface Member {
  id: string
  name: string
  role: string
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
  // только фото без подписи: в text лежит заглушка для старых клиентов
  photoOnly?: boolean
}

// Реакция и начисление монет родителем под сообщением ребёнка.
export interface Reaction { memberId: string; emoji: string }
export interface Award { amount: number; by: string | null }

export interface MessageDto {
  id: string
  senderId: string
  // как лежит в базе: подпись или, у сообщения только с фото, заглушка «📷 Фото» (её видит старая версия клиента)
  text: string
  createdAt: string
  // подпись к фото; у сообщения без фото равна text, у сообщения только с фото пустая
  caption: string
  media: MediaDto[]
  reactions: Reaction[]
  awards: Award[]
}

const toMessage = (row: MessageRow): MessageDto => ({
  id: row.id,
  senderId: row.senderId,
  text: row.text,
  createdAt: row.createdAt,
  caption: row.photoOnly ? '' : row.text,
  media: [],
  reactions: [],
  awards: [],
})

// Добавляет к сообщениям реакции и начисленные монеты (двумя запросами на всю страницу).
async function decorate(db: Pick<Pool, 'query'>, messages: MessageDto[], secret: string | null): Promise<MessageDto[]> {
  if (messages.length === 0) return messages
  const ids = messages.map((m) => m.id)
  const media = await loadMedia(db, secret, ids)
  const { rows: reactions } = await db.query<{ messageId: string; memberId: string; emoji: string }>(
    `select message_id as "messageId", member_id as "memberId", emoji from message_reactions where message_id = any($1) order by created_at`,
    [ids],
  )
  const { rows: awards } = await db.query<{ messageId: string; amount: number; by: string | null }>(
    `select message_id as "messageId", amount, created_by as "by" from coin_transactions where message_id = any($1) order by created_at`,
    [ids],
  )
  return messages.map((m) => ({
    ...m,
    media: media.get(m.id) ?? [],
    reactions: reactions.filter((x) => x.messageId === m.id).map(({ memberId, emoji }) => ({ memberId, emoji })),
    awards: awards.filter((x) => x.messageId === m.id).map(({ amount, by }) => ({ amount, by })),
  }))
}

const PARENT_LABELS: Record<string, string> = { mama: 'Мама', papa: 'Папа' }

// Как получатель видит отправителя: ребёнок видит родителей как «Мама» и «Папа» (как и в самом чате), остальные по имени.
export function senderLabel(sender: { name: string; role: string }, recipientRole: string): string {
  return recipientRole === 'child' ? (PARENT_LABELS[sender.role] ?? sender.name) : sender.name
}

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

const feedbackSchema = {
  params: {
    type: 'object',
    required: ['chat', 'messageId'],
    properties: { chat: chatParams.properties.chat, messageId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      emoji: { anyOf: [{ enum: REACTIONS }, { type: 'null' }] },
      coins: { type: 'integer', minimum: 1, maximum: MAX_AWARD },
    },
  },
}

// Начало сообщения одной строкой для причины в истории монет.
function snippet(text: string, max = 40): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

// Ребёнку: родитель начислил монеты за его сообщение (и, возможно, поставил реакцию).
export function awardPushMessage(parentLabel: string, chatId: string, messageId: string, coins: number, emoji?: string): PushMessage {
  return {
    title: parentLabel,
    body: `+${coinsWord(coins)} за ваше сообщение${emoji ? ` и реакция ${emoji}` : ''}`,
    url: `/chat/${chatId}`,
    tag: `award-${messageId}`,
  }
}

export interface ChatOptions {
  // фото в чатах; null: не настроены (загрузка отвечает 503)
  media: { client: MediaClient; secret: string } | null
}

export async function chatRoutes(app: FastifyInstance, { media = null }: Partial<ChatOptions> = {}) {
  const secret = media?.secret ?? null
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
      `select distinct on (chat_key) chat_key as "chatKey", id, sender_id as "senderId", text, created_at as "createdAt", photo_only as "photoOnly"
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
    const lastMedia = await loadMedia(pool, secret, lasts.map((l) => l.id))
    const lastBy = new Map(lasts.map((l) => [l.chatKey, { ...toMessage(l), media: lastMedia.get(l.id) ?? [] }]))
    const unreadBy = new Map(unreads.map((u) => [u.chatKey, Number(u.count)]))

    const list = chats.map((c) => {
      const last = lastBy.get(c.key)
      return { id: c.id, last: last ?? null, unread: unreadBy.get(c.key) ?? 0 }
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
        `select id, sender_id as "senderId", text, created_at as "createdAt", photo_only as "photoOnly"
         from messages
         where family_id = $1 and chat_key = $2
           and ($3::uuid is null or (created_at, id) < (select created_at, id from messages where id = $3 and chat_key = $2))
         order by created_at desc, id desc limit $4`,
        [member.family_id, chat.key, req.query.before ?? null, limit + 1],
      )
      const hasMore = rows.length > limit

      // До какого момента прочитали остальные участники чата: свои сообщения не позже этого времени отмечаются как прочитанные.
      // В общем чате это самое позднее прочтение среди остальных (как в группах Telegram: «прочитано», когда прочёл хотя бы один;
      // иначе один неактивный участник навсегда оставлял бы все сообщения «отправленными»). Тот, кто чат не открывал, считается
      // прочитавшим с момента появления в семье.
      const peers = chat.participants.filter((id) => id !== member.id)
      const { rows: read } = await pool.query(
        `select max(coalesce(r.last_read_at, m.created_at)) as "readUpTo"
         from members m left join chat_reads r on r.member_id = m.id and r.chat_key = $1
         where m.id = any($2)`,
        [chat.key, peers],
      )
      const page = await decorate(pool, rows.slice(0, limit).reverse().map(toMessage), secret)
      // в личном чате: сидит ли собеседник в нём сейчас и когда был в последний раз
      let peer: { viewing: boolean; lastVisitAt: string | null } | null = null
      if (chat.otherId) {
        const { rows: visit } = await pool.query('select visited_at as "at" from chat_visits where member_id = $1 and chat_key = $2', [chat.otherId, chat.key])
        peer = { viewing: isViewingChat(chat.otherId, member.id), lastVisitAt: (visit[0]?.at as string | undefined) ?? null }
      }
      return { messages: page, hasMore, readUpTo: (read[0]?.readUpTo as string | null) ?? null, peer }
    },
  )

  // Загрузка одного фото для будущего сообщения. Тело: сырой JPEG (клиент уже уменьшил его). server проверяет доступ к чату и квоту,
  // передаёт файл сервису media (он перекодирует и кладёт в хранилище) и записывает файл за автором. К сообщению фото прикрепляется
  // отдельным запросом (mediaIds), не прикреплённое через сутки убирается.
  app.post<{ Params: { chat: string }; Body: Buffer }>(
    '/api/chats/:chat/media',
    { schema: { params: chatParams }, bodyLimit: MAX_PHOTO_BYTES, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      if (!media) return reply.code(503).send({ error: 'media_disabled' })
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      if (!req.headers['content-type']?.startsWith('image/jpeg')) return reply.code(415).send({ error: 'invalid_media' })
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return reply.code(400).send({ error: 'invalid_media' })

      const { rows: used } = await pool.query<{ total: string }>('select coalesce(sum(size), 0) as total from media where family_id = $1', [member.family_id])
      if (Number(used[0].total) + req.body.length > mediaQuotaBytes()) return reply.code(413).send({ error: 'media_quota' })

      const id = randomUUID()
      let result
      try {
        result = await media.client.upload(member.family_id, id, req.body)
      } catch (err) {
        if (err instanceof MediaRejected) return reply.code(400).send({ error: 'invalid_media' })
        req.log.error(err)
        return reply.code(502).send({ error: 'media_unavailable' })
      }
      await pool.query(
        'insert into media (id, family_id, uploader_id, width, height, size) values ($1, $2, $3, $4, $5, $6)',
        [id, member.family_id, member.id, result.width, result.height, result.size],
      )
      return reply.code(201).send({ mediaId: id, width: result.width, height: result.height })
    },
  )

  app.post<{ Params: { chat: string }; Body: { text?: string; mediaIds?: string[] } }>(
    '/api/chats/:chat/messages',
    { schema: sendSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return

      const caption = (req.body.text ?? '').trim()
      const mediaIds = req.body.mediaIds ?? []
      if (caption.length > MAX_TEXT || (caption.length === 0 && mediaIds.length === 0)) return reply.code(400).send({ error: 'invalid_text' })
      if (mediaIds.length > 0 && !media) return reply.code(503).send({ error: 'media_disabled' })
      // сообщение только с фото хранит заглушку (для старых клиентов), подпись пуста
      const photoOnly = mediaIds.length > 0 && caption.length === 0
      const text = photoOnly ? photoPlaceholder(mediaIds.length) : caption

      const tx = await pool.connect()
      let message: MessageDto
      try {
        await tx.query('begin')
        if (mediaIds.length > 0) {
          // фото должны быть загружены этим же участником в его семье и ещё не прикреплены; блокировка защищает от двух сообщений с одним файлом
          const { rows: owned } = await tx.query(
            'select id from media where id = any($1) and family_id = $2 and uploader_id = $3 and attached_at is null for update',
            [mediaIds, member.family_id, member.id],
          )
          if (owned.length !== mediaIds.length) {
            await tx.query('rollback')
            return reply.code(400).send({ error: 'invalid_media' })
          }
        }
        const { rows } = await tx.query<MessageRow>(
          `insert into messages (family_id, chat_key, sender_id, text, photo_only) values ($1, $2, $3, $4, $5)
           returning id, sender_id as "senderId", text, created_at as "createdAt", photo_only as "photoOnly"`,
          [member.family_id, chat.key, member.id, text, photoOnly],
        )
        message = toMessage(rows[0])
        for (const [position, mediaId] of mediaIds.entries()) {
          await tx.query('insert into message_media (message_id, media_id, position) values ($1, $2, $3)', [message.id, mediaId, position])
        }
        if (mediaIds.length > 0) await tx.query('update media set attached_at = now() where id = any($1)', [mediaIds])
        await tx.query('commit')
      } catch (err) {
        await tx.query('rollback').catch(() => {})
        throw err
      } finally {
        tx.release()
      }
      ;[message] = await decorate(pool, [message], secret)
      // своё сообщение читать не нужно
      await pool.query(
        `insert into chat_reads (member_id, chat_key, last_read_at) values ($1, $2, $3)
         on conflict (member_id, chat_key) do update set last_read_at = excluded.last_read_at`,
        [member.id, chat.key, message.createdAt],
      )
      // в уведомлении фото отмечено значком: «📷 Фото» или «📷 подпись»
      const pushText = mediaIds.length === 0 || photoOnly ? text : `📷 ${text}`

      // каждому участнику (и другим устройствам автора) сигнал с чатом, каким он виден ему: общий или собеседник
      const { rows: roles } = await pool.query<{ id: string; role: string }>('select id, role from members where id = any($1)', [chat.participants])
      const roleOf = new Map(roles.map((r) => [r.id, r.role]))
      for (const id of chat.participants) {
        const view = chat.otherId === null ? FAMILY_CHAT : id === member.id ? chat.otherId : member.id
        publishTo(id, { type: 'chat', chat: view })
        // если получатель прямо сейчас смотрит этот чат, пуш не нужен: сообщение появится на экране
        if (id !== member.id && !isViewingChat(id, view)) void enqueueToMember(pool, id, chatPushMessage(senderLabel(member, roleOf.get(id) ?? ''), view, pushText))
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
  // Реакция и/или монеты на сообщение в доступном чате. Реакцию ставит любой участник чата на любое сообщение,
  // монеты начисляет только родитель и только автору-ребёнку.
  // emoji: поставить реакцию (null снимает свою), coins: начислить монеты автору сообщения. Нужно хотя бы одно.
  app.post<{ Params: { chat: string; messageId: string }; Body: { emoji?: string | null; coins?: number } }>(
    '/api/chats/:chat/messages/:messageId/feedback',
    { schema: feedbackSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const { emoji, coins } = req.body
      if (emoji === undefined && coins === undefined) return reply.code(400).send({ error: 'nothing_to_do' })
      if (coins !== undefined && member.role === 'child') return reply.code(403).send({ error: 'parents_only' })

      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      const { rows: found } = await pool.query<MessageRow & { senderRole: string }>(
        `select m.id, m.sender_id as "senderId", m.text, m.created_at as "createdAt", m.photo_only as "photoOnly", s.role as "senderRole"
         from messages m join members s on s.id = m.sender_id
         where m.id = $1 and m.family_id = $2 and m.chat_key = $3`,
        [req.params.messageId, member.family_id, chat.key],
      )
      const row = found[0]
      if (!row) return reply.code(404).send({ error: 'message_not_found' })
      // монеты только на сообщения детей
      if (coins !== undefined && row.senderRole !== 'child') return reply.code(400).send({ error: 'not_a_child_message' })

      const db = await pool.connect()
      try {
        await db.query('begin')
        if (emoji === null) await db.query('delete from message_reactions where message_id = $1 and member_id = $2', [row.id, member.id])
        else if (emoji !== undefined) {
          await db.query(
            `insert into message_reactions (message_id, member_id, emoji) values ($1, $2, $3)
             on conflict (message_id, member_id) do update set emoji = excluded.emoji, created_at = now()`,
            [row.id, member.id, emoji],
          )
        }
        if (coins !== undefined) {
          await db.query(
            `insert into coin_transactions (member_id, amount, reason, created_by, message_id) values ($1, $2, $3, $4, $5)`,
            [row.senderId, coins, `За сообщение: ${snippet(row.text)}`, member.id, row.id],
          )
        }
        await db.query('commit')
      } catch (err) {
        await db.query('rollback').catch(() => {})
        throw err
      } finally {
        db.release()
      }

      // всем участникам чата: под сообщением появились реакции и монеты
      for (const id of chat.participants) {
        const view = chat.otherId === null ? FAMILY_CHAT : id === member.id ? chat.otherId : member.id
        publishTo(id, { type: 'chat', chat: view })
      }
      if (coins !== undefined) {
        // баланс ребёнка изменился; ему приходит уведомление о начислении
        publish(member.family_id, { type: 'members' })
        const view = chat.otherId === null ? FAMILY_CHAT : member.id
        void enqueueToMember(pool, row.senderId, awardPushMessage(senderLabel(member, 'child'), view, row.id, coins, emoji ?? undefined))
      }

      const [message] = await decorate(pool, [toMessage(row)], secret)
      return { message }
    },
  )
}
