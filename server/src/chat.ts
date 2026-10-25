import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { authenticate } from './auth.js'
import { directKey, eventChatId, eventChatKey, EVENT_CHAT_PREFIX } from './chatKey.js'
import { MediaRejected, type MediaClient } from './media/client.js'
import {
  attachmentPlaceholder,
  cleanFileName,
  isBlockedFile,
  loadFiles,
  loadMedia,
  loadVideos,
  maxFileBytes,
  maxVideoBytes,
  mediaUrls,
  MAX_FILES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MAX_VIDEOS,
  mediaQuotaBytes,
  type FileDto,
  type MediaDto,
  type VideoDto,
} from './media/index.js'
import { pool } from './db.js'
import type { PushMessage } from './outbox/contract.js'
import { coinsWord } from './tasks/text.js'
import { enqueueToMember } from './outbox/index.js'
import { isViewingChat, publish, publishTo } from './realtime.js'
import { isParent } from './roles.js'

const MAX_TEXT = 2000

// Реакции, которые участник может поставить на сообщение (тот же список на клиенте, lib/reactions.ts).
export const REACTIONS = ['👍', '❤️', '🔥', '👏', '🎉', '💪', '🤩', '😍']
const MAX_AWARD = 1000
const PAGE_SIZE = 50
// фото на странице экрана «Медиа файлы»
const MEDIA_PAGE_SIZE = 60
const PREVIEW_LENGTH = 140
// результатов поиска и сообщений со ссылками на странице
const SEARCH_PAGE_SIZE = 30
const LINKS_PAGE_SIZE = 30

// Ссылки http(s) из текста сообщения по порядку, без повторов; знаки препинания в конце не входят в ссылку
export function extractLinks(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"']+/gi) ?? []
  return [...new Set(found.map((url) => url.replace(/[.,;:!?)\]}»]+$/, '')))].filter((url) => /^https?:\/\/[^/.]+\./i.test(url) || /^https?:\/\/localhost/i.test(url))
}

export const FAMILY_CHAT = 'family'

export { directKey }

const chatParams = {
  type: 'object',
  required: ['chat'],
  properties: { chat: { type: 'string', pattern: '^(family|(event-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' } },
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
const listMediaSchema = {
  params: chatParams,
  querystring: {
    type: 'object',
    properties: {
      before: { type: 'string', format: 'uuid' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: MEDIA_PAGE_SIZE },
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
      // файлы, загруженные через POST /api/chats/:chat/files, в порядке показа (после фото)
      fileIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: MAX_FILES, uniqueItems: true },
      // видео, загруженные через POST /api/chats/:chat/videos, в порядке показа (после файлов)
      videoIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: MAX_VIDEOS, uniqueItems: true },
      // сообщение этого же чата, на которое отвечаем
      replyTo: { type: 'string', format: 'uuid' },
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
  // собеседник для личного чата, null для общего и для чата события
  otherId: string | null
  // название события, если это чат события
  eventTitle: string | null
  // как чат называется в адресе у участника participantId, когда действие совершил actorId: общий и событие у всех одинаковые,
  // личный виден собеседником
  view: (participantId: string, actorId: string) => string
}

interface MessageRow {
  id: string
  senderId: string
  text: string
  createdAt: string
  // только фото без подписи: в text лежит заглушка для старых клиентов
  photoOnly?: boolean
  // сообщение, на которое это ответ, и момент правки
  replyToId?: string | null
  editedAt?: string | null
}

// Реакция и начисление монет родителем под сообщением ребёнка.
export interface Reaction { memberId: string; emoji: string }
export interface Award { amount: number; by: string | null }

// Короткая выдержка из исходного сообщения, на которое ответили.
export interface ReplyDto { id: string; senderId: string; text: string }

export interface MessageDto {
  id: string
  senderId: string
  // как лежит в базе: подпись или, у сообщения только с фото, заглушка «📷 Фото» (её видит старая версия клиента)
  text: string
  createdAt: string
  // подпись к фото; у сообщения без фото равна text, у сообщения только с фото пустая
  caption: string
  media: MediaDto[]
  // обычные файлы (документы, архивы…); у сообщений без файлов пусто
  files: FileDto[]
  // видео (сжатые сервисом media); у сообщений без видео пусто
  videos: VideoDto[]
  // ответ на сообщение; null, если это не ответ или исходное удалено
  replyTo: ReplyDto | null
  // когда сообщение изменили; null, если не менялось
  editedAt: string | null
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
  files: [],
  videos: [],
  // заглушка с id: выдержку подставляет decorate
  replyTo: row.replyToId ? { id: row.replyToId, senderId: '', text: '' } : null,
  editedAt: row.editedAt ?? null,
  reactions: [],
  awards: [],
})

// Добавляет к сообщениям реакции и начисленные монеты (двумя запросами на всю страницу).
async function decorate(db: Pick<Pool, 'query'>, messages: MessageDto[], secret: string | null): Promise<MessageDto[]> {
  if (messages.length === 0) return messages
  const ids = messages.map((m) => m.id)
  const media = await loadMedia(db, secret, ids)
  const files = await loadFiles(db, secret, ids)
  const videos = await loadVideos(db, secret, ids)
  const { rows: reactions } = await db.query<{ messageId: string; memberId: string; emoji: string }>(
    `select message_id as "messageId", member_id as "memberId", emoji from message_reactions where message_id = any($1) order by created_at`,
    [ids],
  )
  const { rows: awards } = await db.query<{ messageId: string; amount: number; by: string | null }>(
    `select message_id as "messageId", amount, created_by as "by" from coin_transactions where message_id = any($1) order by created_at`,
    [ids],
  )
  const replyIds = [...new Set(messages.flatMap((m) => (m.replyTo ? [m.replyTo.id] : [])))]
  const { rows: originals } = replyIds.length
    ? await db.query<{ id: string; senderId: string; text: string }>('select id, sender_id as "senderId", text from messages where id = any($1)', [replyIds])
    : { rows: [] }
  const originalOf = new Map(originals.map((o) => [o.id, { id: o.id, senderId: o.senderId, text: snippet(o.text, PREVIEW_LENGTH) }]))
  return messages.map((m) => ({
    ...m,
    replyTo: m.replyTo ? (originalOf.get(m.replyTo.id) ?? null) : null,
    media: media.get(m.id) ?? [],
    files: files.get(m.id) ?? [],
    videos: videos.get(m.id) ?? [],
    reactions: reactions.filter((x) => x.messageId === m.id).map(({ memberId, emoji }) => ({ memberId, emoji })),
    awards: awards.filter((x) => x.messageId === m.id).map(({ amount, by }) => ({ amount, by })),
  }))
}

const PARENT_LABELS: Record<string, string> = { mama: 'Мама', papa: 'Папа', grandma: 'Бабушка', grandpa: 'Дедушка' }

// Как получатель видит отправителя: ребёнок видит взрослых как «Мама», «Папа», «Бабушка» и «Дедушка» (как и в самом чате), остальные по имени.
export function senderLabel(sender: { name: string; role: string }, recipientRole: string): string {
  return recipientRole === 'child' ? (PARENT_LABELS[sender.role] ?? sender.name) : sender.name
}

// «Имя · Общий чат» для общего чата, просто имя для личного. Текст сжат до одной строки.
export function chatPushMessage(senderName: string, chatId: string, text: string, eventTitle?: string | null): PushMessage {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  const body = oneLine.length > PREVIEW_LENGTH ? `${oneLine.slice(0, PREVIEW_LENGTH - 1)}…` : oneLine
  return {
    title: eventTitle ? `${senderName} · ${eventTitle}` : chatId === FAMILY_CHAT ? `${senderName} · Общий чат` : senderName,
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
      return { key: FAMILY_CHAT, participants: rows.map((r) => r.id as string), otherId: null, eventTitle: null, view: () => FAMILY_CHAT }
    }
    if (chat.startsWith(EVENT_CHAT_PREFIX)) {
      // чат события доступен тем, кому видно само событие; чужое и несуществующее одинаково «не найдено»
      const eventId = chat.slice(EVENT_CHAT_PREFIX.length)
      const { rows: events } = await pool.query<{ title: string; allFamily: boolean; authorId: string }>(
        `select e.title, e.all_family as "allFamily", e.author_id as "authorId" from events e
         where e.id = $1 and e.family_id = $2
           and (e.all_family or e.author_id = $3 or exists (select 1 from event_members em where em.event_id = e.id and em.member_id = $3))`,
        [eventId, member.family_id, member.id],
      )
      if (!events[0]) {
        reply.code(404).send({ error: 'chat_not_found' })
        return null
      }
      const { rows: people } = await pool.query<{ id: string }>(
        `select m.id from members m
         where m.family_id = $1
           and ($2 or m.id = $3 or exists (select 1 from event_members em where em.event_id = $4 and em.member_id = m.id))`,
        [member.family_id, events[0].allFamily, events[0].authorId, eventId],
      )
      return { key: eventChatKey(eventId), participants: people.map((p) => p.id), otherId: null, eventTitle: events[0].title, view: () => chat }
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
    return { key: directKey(member.id, chat), participants: [member.id, chat], otherId: chat, eventTitle: null, view: (participantId, actorId) => (participantId === actorId ? chat : actorId) }
  }

  // Список чатов: общий и по одному с каждым участником, свежая активность выше.
  // Чаты без сообщений идут в конце: сначала общий, затем по имени.
  app.get('/api/chats', async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return

    const { rows: others } = await pool.query(
      'select id, name, created_at as "createdAt" from members where family_id = $1 and id <> $2 order by lower(name)',
      [member.family_id, member.id],
    )
    // чаты событий появляются в списке, когда в них написали первое сообщение (и только у тех, кому видно событие)
    const { rows: eventChats } = await pool.query<{ id: string; title: string }>(
      `select e.id, e.title from events e
       where e.family_id = $1
         and (e.all_family or e.author_id = $2 or exists (select 1 from event_members em where em.event_id = e.id and em.member_id = $2))
         and exists (select 1 from messages m where m.family_id = e.family_id and m.chat_key = 'event:' || e.id)`,
      [member.family_id, member.id],
    )
    const chats: { id: string; key: string; event?: { id: string; title: string } }[] = [
      { id: FAMILY_CHAT, key: FAMILY_CHAT },
      ...others.map((o) => ({ id: o.id as string, key: directKey(member.id, o.id) })),
      ...eventChats.map((e) => ({ id: eventChatId(e.id), key: eventChatKey(e.id), event: { id: e.id, title: e.title } })),
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
    const { rows: mutes } = await pool.query<{ chatKey: string }>('select chat_key as "chatKey" from chat_mutes where member_id = $1 and chat_key = any($2)', [member.id, keys])
    const mutedKeys = new Set(mutes.map((m) => m.chatKey))
    const { rows: archives } = await pool.query<{ chatKey: string }>('select chat_key as "chatKey" from chat_archives where member_id = $1 and chat_key = any($2)', [member.id, keys])
    const archivedKeys = new Set(archives.map((a) => a.chatKey))
    // До какого момента прочитали остальные участники чата (как в самом чате: в общем самое позднее прочтение, кто чат не открывал,
    // читает с момента появления в семье). По нему в списке у моего последнего сообщения видна галочка «прочитано».
    const { rows: reads } = await pool.query<{ memberId: string; chatKey: string; at: Date }>(
      'select member_id as "memberId", chat_key as "chatKey", last_read_at as at from chat_reads where chat_key = any($1) and member_id <> $2',
      [keys, member.id],
    )
    const readAt = new Map(reads.map((r) => [`${r.chatKey}|${r.memberId}`, r.at]))
    // участники чатов событий, кроме меня, и их прочтения (у не открывавшего чат отсчёт с появления в семье)
    const { rows: eventPeers } = await pool.query<{ chatKey: string; at: Date }>(
      `select 'event:' || e.id as "chatKey", max(coalesce(r.last_read_at, mb.created_at)) as at
       from events e
       join members mb on mb.family_id = e.family_id and mb.id <> $2
         and (e.all_family or mb.id = e.author_id or exists (select 1 from event_members em where em.event_id = e.id and em.member_id = mb.id))
       left join chat_reads r on r.member_id = mb.id and r.chat_key = 'event:' || e.id
       where e.id = any($1) group by e.id`,
      [eventChats.map((e) => e.id), member.id],
    )
    const eventReadAt = new Map(eventPeers.map((p) => [p.chatKey, p.at]))
    const readUpTo = (chat: { id: string; key: string; event?: unknown }): Date | null => {
      if (chat.event) return eventReadAt.get(chat.key) ?? null
      const peers = chat.id === FAMILY_CHAT ? others : others.filter((o) => o.id === chat.id)
      let best: Date | null = null
      for (const p of peers) {
        const at = readAt.get(`${chat.key}|${p.id}`) ?? (p.createdAt as Date)
        if (!best || at > best) best = at
      }
      return best
    }
    const lastMedia = await loadMedia(pool, secret, lasts.map((l) => l.id))
    const lastFiles = await loadFiles(pool, secret, lasts.map((l) => l.id))
    const lastVideos = await loadVideos(pool, secret, lasts.map((l) => l.id))
    const lastBy = new Map(lasts.map((l) => [l.chatKey, { ...toMessage(l), media: lastMedia.get(l.id) ?? [], files: lastFiles.get(l.id) ?? [], videos: lastVideos.get(l.id) ?? [] }]))
    const unreadBy = new Map(unreads.map((u) => [u.chatKey, Number(u.count)]))

    const list = chats.map((c) => {
      const last = lastBy.get(c.key)
      return { id: c.id, last: last ?? null, unread: unreadBy.get(c.key) ?? 0, muted: mutedKeys.has(c.key), archived: archivedKeys.has(c.key), readUpTo: readUpTo(c), event: c.event ?? null }
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

  // Все фото чата, свежие первыми (экран «Медиа файлы»). before = id самого старого уже загруженного фото. Доступ как к самому чату;
  // порядок: сообщения от новых к старым, внутри сообщения по порядку фото.
  app.get<{ Params: { chat: string }; Querystring: { before?: string; limit?: number } }>(
    '/api/chats/:chat/media',
    { schema: listMediaSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      if (!secret) return { items: [], hasMore: false }

      const limit = req.query.limit ?? MEDIA_PAGE_SIZE
      const { rows } = await pool.query<{ id: string; width: number; height: number; messageId: string; senderId: string; createdAt: Date }>(
        `select md.id, md.width, md.height, ms.id as "messageId", ms.sender_id as "senderId", ms.created_at as "createdAt"
         from message_media mm
         join media md on md.id = mm.media_id
         join messages ms on ms.id = mm.message_id
         where ms.family_id = $1 and ms.chat_key = $2 and md.kind = 'image'
           and ($3::uuid is null or (ms.created_at, ms.id, -mm.position) < (
             select ms2.created_at, ms2.id, -mm2.position from message_media mm2 join messages ms2 on ms2.id = mm2.message_id
             where mm2.media_id = $3 and ms2.chat_key = $2))
         order by ms.created_at desc, ms.id desc, mm.position asc limit $4`,
        [member.family_id, chat.key, req.query.before ?? null, limit + 1],
      )
      const now = new Date()
      const items = rows.slice(0, limit).map((r) => ({
        id: r.id,
        width: r.width,
        height: r.height,
        ...mediaUrls(secret, member.family_id, r.id, now),
        messageId: r.messageId,
        senderId: r.senderId,
        createdAt: r.createdAt,
      }))
      return { items, hasMore: rows.length > limit }
    },
  )

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
        `select id, sender_id as "senderId", text, created_at as "createdAt", photo_only as "photoOnly",
                reply_to as "replyToId", edited_at as "editedAt"
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

  // Поиск сообщений чата по тексту (без учёта регистра), свежие первыми. before = id самого старого из уже найденных.
  // Сообщения только с вложениями (в text заглушка) не ищутся.
  app.get<{ Params: { chat: string }; Querystring: { q: string; before?: string; limit?: number } }>(
    '/api/chats/:chat/search',
    {
      schema: {
        params: chatParams,
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 100 },
            before: { type: 'string', format: 'uuid' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: SEARCH_PAGE_SIZE },
          },
        },
      },
    },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      const query = req.query.q.trim()
      if (!query) return { messages: [], hasMore: false }

      const limit = req.query.limit ?? SEARCH_PAGE_SIZE
      // символы шаблона LIKE в запросе ищутся как обычный текст
      const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
      const { rows } = await pool.query<MessageRow>(
        `select id, sender_id as "senderId", text, created_at as "createdAt"
         from messages
         where family_id = $1 and chat_key = $2 and not photo_only and text ilike $3
           and ($4::uuid is null or (created_at, id) < (select created_at, id from messages where id = $4 and chat_key = $2))
         order by created_at desc, id desc limit $5`,
        [member.family_id, chat.key, pattern, req.query.before ?? null, limit + 1],
      )
      return { messages: rows.slice(0, limit).map(({ id, senderId, text, createdAt }) => ({ id, senderId, text, createdAt })), hasMore: rows.length > limit }
    },
  )

  // Все ссылки из сообщений чата, свежие первыми (вкладка «Ссылки»). before = id самого старого сообщения из уже загруженных.
  // Страница считается по сообщениям (в одном может быть несколько ссылок).
  app.get<{ Params: { chat: string }; Querystring: { before?: string; limit?: number } }>(
    '/api/chats/:chat/links',
    { schema: { params: chatParams, querystring: listMessagesSchema.querystring } },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return

      const limit = Math.min(req.query.limit ?? LINKS_PAGE_SIZE, LINKS_PAGE_SIZE)
      const { rows } = await pool.query<MessageRow>(
        `select id, sender_id as "senderId", text, created_at as "createdAt"
         from messages
         where family_id = $1 and chat_key = $2 and not photo_only and text ~* 'https?://'
           and ($3::uuid is null or (created_at, id) < (select created_at, id from messages where id = $3 and chat_key = $2))
         order by created_at desc, id desc limit $4`,
        [member.family_id, chat.key, req.query.before ?? null, limit + 1],
      )
      const items = rows.slice(0, limit).flatMap((m) => extractLinks(m.text).map((url) => ({ url, messageId: m.id, senderId: m.senderId, createdAt: m.createdAt })))
      return { items, hasMore: rows.length > limit, lastMessageId: rows.length > 0 ? rows[Math.min(limit, rows.length) - 1].id : null }
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

  // Загрузка одного видео для будущего сообщения. Тело: сырой файл с типом video/* (до 100 МБ, до 3 минут). Сервис media сжимает его
  // (MP4, H.264, до 720p) и делает кадр-превью; это занимает время, поэтому ответ приходит после обработки. Квота семьи общая с фото и файлами
  // (считается сжатое видео); к сообщению видео прикрепляется через videoIds, не прикреплённое через сутки убирается.
  app.post<{ Params: { chat: string }; Body: Buffer }>(
    '/api/chats/:chat/videos',
    { schema: { params: chatParams }, bodyLimit: maxVideoBytes(), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      if (!media) return reply.code(503).send({ error: 'media_disabled' })
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      const type = String(req.headers['content-type'] ?? '')
      if (!type.startsWith('video/')) return reply.code(415).send({ error: 'invalid_video' })
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return reply.code(400).send({ error: 'invalid_video' })

      const { rows: used } = await pool.query<{ total: string }>('select coalesce(sum(size), 0) as total from media where family_id = $1', [member.family_id])
      if (Number(used[0].total) + req.body.length > mediaQuotaBytes()) return reply.code(413).send({ error: 'media_quota' })

      const id = randomUUID()
      let result
      try {
        result = await media.client.uploadVideo(member.family_id, id, req.body, type.split(';')[0])
      } catch (err) {
        if (err instanceof MediaRejected) return reply.code(400).send({ error: err.code === 'video_too_long' ? 'video_too_long' : 'invalid_video' })
        req.log.error(err)
        return reply.code(502).send({ error: 'media_unavailable' })
      }
      await pool.query(
        "insert into media (id, family_id, uploader_id, kind, width, height, duration, size) values ($1, $2, $3, 'video', $4, $5, $6, $7)",
        [id, member.family_id, member.id, result.width, result.height, result.duration, result.size],
      )
      return reply.code(201).send({ videoId: id, width: result.width, height: result.height, duration: result.duration })
    },
  )

  // Загрузка одного файла (документ, архив…) для будущего сообщения. Тело: сырые байты, имя в заголовке x-file-name (в процентной
  // записи UTF-8). Содержимое не разбирается и не исполняется: сервис media отдаёт файл только как скачиваемый бинарный. Исполняемое,
  // сценарии и страницы не принимаются. Квота семьи общая с фото; к сообщению файл прикрепляется через fileIds.
  app.post<{ Params: { chat: string }; Body: Buffer }>(
    '/api/chats/:chat/files',
    { schema: { params: chatParams }, bodyLimit: maxFileBytes(), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      if (!media) return reply.code(503).send({ error: 'media_disabled' })
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return reply.code(400).send({ error: 'invalid_file' })

      let decoded = ''
      try {
        decoded = decodeURIComponent(String(req.headers['x-file-name'] ?? ''))
      } catch {
        return reply.code(400).send({ error: 'invalid_file' })
      }
      const name = cleanFileName(decoded)
      if (!name) return reply.code(400).send({ error: 'invalid_file' })
      if (isBlockedFile(name)) return reply.code(415).send({ error: 'file_type_blocked' })

      const { rows: used } = await pool.query<{ total: string }>('select coalesce(sum(size), 0) as total from media where family_id = $1', [member.family_id])
      if (Number(used[0].total) + req.body.length > mediaQuotaBytes()) return reply.code(413).send({ error: 'media_quota' })

      const id = randomUUID()
      try {
        await media.client.uploadFile(member.family_id, id, req.body)
      } catch (err) {
        req.log.error(err)
        return reply.code(502).send({ error: 'media_unavailable' })
      }
      await pool.query(
        "insert into media (id, family_id, uploader_id, kind, file_name, size) values ($1, $2, $3, 'file', $4, $5)",
        [id, member.family_id, member.id, name, req.body.length],
      )
      return reply.code(201).send({ fileId: id, name, size: req.body.length })
    },
  )

  app.post<{ Params: { chat: string }; Body: { text?: string; mediaIds?: string[]; fileIds?: string[]; videoIds?: string[]; replyTo?: string } }>(
    '/api/chats/:chat/messages',
    { schema: sendSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return

      // отвечать можно только на сообщение этого же чата
      const replyTo = req.body.replyTo ?? null
      if (replyTo) {
        const { rows } = await pool.query('select 1 from messages where id = $1 and family_id = $2 and chat_key = $3', [replyTo, member.family_id, chat.key])
        if (!rows[0]) return reply.code(400).send({ error: 'invalid_reply' })
      }

      const caption = (req.body.text ?? '').trim()
      const photoIds = req.body.mediaIds ?? []
      const fileIds = req.body.fileIds ?? []
      const videoIds = req.body.videoIds ?? []
      const mediaIds = [...photoIds, ...fileIds, ...videoIds]
      if (caption.length > MAX_TEXT || (caption.length === 0 && mediaIds.length === 0)) return reply.code(400).send({ error: 'invalid_text' })
      if (mediaIds.length > 0 && !media) return reply.code(503).send({ error: 'media_disabled' })
      // сообщение только с вложениями хранит заглушку (для старых клиентов), подпись пуста
      const photoOnly = mediaIds.length > 0 && caption.length === 0
      let text = caption
      let fileNames: { name: string }[] = []

      const tx = await pool.connect()
      let message: MessageDto
      try {
        await tx.query('begin')
        if (mediaIds.length > 0) {
          // фото должны быть загружены этим же участником в его семье и ещё не прикреплены; блокировка защищает от двух сообщений с одним файлом
          const { rows: owned } = await tx.query<{ id: string; kind: string; fileName: string | null }>(
            'select id, kind, file_name as "fileName" from media where id = any($1) and family_id = $2 and uploader_id = $3 and attached_at is null for update',
            [mediaIds, member.family_id, member.id],
          )
          // все на месте, и фото в mediaIds, а файлы в fileIds (виды не путаются)
          const kindOf = new Map(owned.map((o) => [o.id, o.kind]))
          if (owned.length !== mediaIds.length || photoIds.some((id) => kindOf.get(id) !== 'image') || fileIds.some((id) => kindOf.get(id) !== 'file') || videoIds.some((id) => kindOf.get(id) !== 'video')) {
            await tx.query('rollback')
            return reply.code(400).send({ error: 'invalid_media' })
          }
          fileNames = fileIds.map((id) => ({ name: owned.find((o) => o.id === id)!.fileName ?? '' }))
          if (photoOnly) text = attachmentPlaceholder(photoIds.length, fileNames, videoIds.length)
        }
        const { rows } = await tx.query<MessageRow>(
          `insert into messages (family_id, chat_key, sender_id, text, photo_only, reply_to) values ($1, $2, $3, $4, $5, $6)
           returning id, sender_id as "senderId", text, created_at as "createdAt", photo_only as "photoOnly", reply_to as "replyToId"`,
          [member.family_id, chat.key, member.id, text, photoOnly, replyTo],
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
      const pushText = mediaIds.length === 0 || photoOnly ? text : `${photoIds.length > 0 ? '📷' : videoIds.length > 0 ? '🎬' : '📎'} ${text}`

      // каждому участнику (и другим устройствам автора) сигнал с чатом, каким он виден ему: общий или собеседник
      const { rows: roles } = await pool.query<{ id: string; role: string }>('select id, role from members where id = any($1)', [chat.participants])
      const roleOf = new Map(roles.map((r) => [r.id, r.role]))
      const { rows: muted } = await pool.query<{ id: string }>('select member_id as id from chat_mutes where chat_key = $1 and member_id = any($2)', [chat.key, chat.participants])
      const mutedIds = new Set(muted.map((m) => m.id))
      for (const id of chat.participants) {
        const view = chat.view(id, member.id)
        publishTo(id, { type: 'chat', chat: view })
        // если получатель прямо сейчас смотрит этот чат, пуш не нужен: сообщение появится на экране
        if (id !== member.id && !mutedIds.has(id) && !isViewingChat(id, view)) void enqueueToMember(pool, id, chatPushMessage(senderLabel(member, roleOf.get(id) ?? ''), view, pushText, chat.eventTitle))
      }
      return reply.code(201).send({ message })
    },
  )

  // Отключить или включить уведомления чата (только для себя, на всех своих устройствах). Счётчик непрочитанного остаётся.
  app.put<{ Params: { chat: string }; Body: { muted: boolean } }>(
    '/api/chats/:chat/mute',
    { schema: { params: chatParams, body: { type: 'object', required: ['muted'], additionalProperties: false, properties: { muted: { type: 'boolean' } } } } },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      if (req.body.muted) {
        await pool.query('insert into chat_mutes (member_id, chat_key) values ($1, $2) on conflict do nothing', [member.id, chat.key])
      } else {
        await pool.query('delete from chat_mutes where member_id = $1 and chat_key = $2', [member.id, chat.key])
      }
      // другие устройства этого же участника обновят список чатов
      publishTo(member.id, { type: 'chat', chat: req.params.chat })
      return reply.code(204).send()
    },
  )

  // В архив и обратно (только для себя, на всех своих устройствах). Архивный чат не показывается в списке, но остаётся полноценным:
  // в него можно писать, сообщения приходят, уведомления идут как обычно (их отключают отдельно).
  app.put<{ Params: { chat: string }; Body: { archived: boolean } }>(
    '/api/chats/:chat/archive',
    { schema: { params: chatParams, body: { type: 'object', required: ['archived'], additionalProperties: false, properties: { archived: { type: 'boolean' } } } } },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      if (req.body.archived) {
        await pool.query('insert into chat_archives (member_id, chat_key) values ($1, $2) on conflict do nothing', [member.id, chat.key])
      } else {
        await pool.query('delete from chat_archives where member_id = $1 and chat_key = $2', [member.id, chat.key])
      }
      // другие устройства этого же участника обновят список чатов
      publishTo(member.id, { type: 'chat', chat: req.params.chat })
      return reply.code(204).send()
    },
  )

  // Очистка чата: удаляет все сообщения (и их фото) у всех участников, безвозвратно. Только родитель; в личном чате он должен быть
  // участником (чужие личные чаты недоступны, как и их чтение). Реакции пропадают вместе с сообщениями, монеты остаются.
  app.delete<{ Params: { chat: string } }>('/api/chats/:chat/messages', { schema: { params: chatParams } }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    if (!isParent(member.role)) return reply.code(403).send({ error: 'parents_only' })
    const chat = await resolveChat(member, req.params.chat, reply)
    if (!chat) return

    const client = await pool.connect()
    let files: { id: string }[]
    try {
      await client.query('begin')
      const { rows } = await client.query<{ id: string }>(
        `select mm.media_id as id from message_media mm join messages m on m.id = mm.message_id where m.family_id = $1 and m.chat_key = $2`,
        [member.family_id, chat.key],
      )
      files = rows
      await client.query('delete from messages where family_id = $1 and chat_key = $2', [member.family_id, chat.key])
      if (files.length > 0) await client.query('delete from media where id = any($1)', [files.map((f) => f.id)])
      await client.query('commit')
    } catch (err) {
      await client.query('rollback').catch(() => {})
      throw err
    } finally {
      client.release()
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
    // каждый участник обновит чат и список (чат глазами получателя)
    for (const id of chat.participants) {
      publishTo(id, { type: 'chat', chat: chat.view(id, member.id) })
    }
    return reply.code(204).send()
  })

  const messageParams = {
    type: 'object',
    required: ['chat', 'messageId'],
    properties: { chat: chatParams.properties.chat, messageId: { type: 'string', format: 'uuid' } },
  }

  // Сообщение чата для правки или удаления: только своё (чужое 403), несуществующее 404.
  async function ownMessage(req: FastifyRequest<{ Params: { chat: string; messageId: string } }>, reply: FastifyReply) {
    const member = await me(req, reply)
    if (!member) return null
    const chat = await resolveChat(member, req.params.chat, reply)
    if (!chat) return null
    const { rows } = await pool.query<MessageRow>(
      `select id, sender_id as "senderId", text, created_at as "createdAt", photo_only as "photoOnly", reply_to as "replyToId", edited_at as "editedAt"
       from messages where id = $1 and family_id = $2 and chat_key = $3`,
      [req.params.messageId, member.family_id, chat.key],
    )
    if (!rows[0]) {
      reply.code(404).send({ error: 'message_not_found' })
      return null
    }
    if (rows[0].senderId !== member.id) {
      reply.code(403).send({ error: 'forbidden' })
      return null
    }
    return { member, chat, row: rows[0] }
  }

  // Правка текста своего сообщения. Сообщение только с вложениями без подписи править нельзя (текста нет); подпись можно.
  app.patch<{ Params: { chat: string; messageId: string }; Body: { text: string } }>(
    '/api/chats/:chat/messages/:messageId',
    { schema: { params: messageParams, body: { type: 'object', required: ['text'], additionalProperties: false, properties: { text: { type: 'string', maxLength: MAX_TEXT + 2000 } } } } },
    async (req, reply) => {
      const found = await ownMessage(req, reply)
      if (!found) return
      const { member, chat, row } = found
      if (row.photoOnly) return reply.code(400).send({ error: 'not_editable' })
      const text = req.body.text.trim()
      if (text.length === 0 || text.length > MAX_TEXT) return reply.code(400).send({ error: 'invalid_text' })

      const { rows } = await pool.query<MessageRow>(
        `update messages set text = $2, edited_at = now() where id = $1
         returning id, sender_id as "senderId", text, created_at as "createdAt", photo_only as "photoOnly", reply_to as "replyToId", edited_at as "editedAt"`,
        [row.id, text],
      )
      for (const id of chat.participants) publishTo(id, { type: 'chat', chat: chat.view(id, member.id) })
      const [message] = await decorate(pool, [toMessage(rows[0])], secret)
      return { message }
    },
  )

  // Удаление своего сообщения у всех участников. Реакции пропадают, ответы на него остаются без цитаты, монеты остаются,
  // вложения убираются вместе с записями (файлы в хранилище после фиксации).
  app.delete<{ Params: { chat: string; messageId: string } }>('/api/chats/:chat/messages/:messageId', { schema: { params: messageParams } }, async (req, reply) => {
    const found = await ownMessage(req, reply)
    if (!found) return
    const { member, chat, row } = found

    const client = await pool.connect()
    let files: { id: string }[]
    try {
      await client.query('begin')
      const { rows } = await client.query<{ id: string }>('select media_id as id from message_media where message_id = $1', [row.id])
      files = rows
      await client.query('delete from messages where id = $1', [row.id])
      if (files.length > 0) await client.query('delete from media where id = any($1)', [files.map((f) => f.id)])
      await client.query('commit')
    } catch (err) {
      await client.query('rollback').catch(() => {})
      throw err
    } finally {
      client.release()
    }
    if (media) {
      for (const f of files) {
        try {
          await media.client.delete(member.family_id, f.id)
        } catch (err) {
          req.log.warn(err)
        }
      }
    }
    for (const id of chat.participants) publishTo(id, { type: 'chat', chat: chat.view(id, member.id) })
    return reply.code(204).send()
  })

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
        if (id !== member.id) publishTo(id, { type: 'chat', chat: chat.view(id, member.id) })
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
      if (coins !== undefined && !isParent(member.role)) return reply.code(403).send({ error: 'parents_only' })

      const chat = await resolveChat(member, req.params.chat, reply)
      if (!chat) return
      const { rows: found } = await pool.query<MessageRow & { senderRole: string }>(
        `select m.id, m.sender_id as "senderId", m.text, m.created_at as "createdAt", m.photo_only as "photoOnly",
                m.reply_to as "replyToId", m.edited_at as "editedAt", s.role as "senderRole"
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
        publishTo(id, { type: 'chat', chat: chat.view(id, member.id) })
      }
      if (coins !== undefined) {
        // баланс ребёнка изменился; ему приходит уведомление о начислении
        publish(member.family_id, { type: 'members' })
        void enqueueToMember(pool, row.senderId, awardPushMessage(senderLabel(member, 'child'), chat.view(row.senderId, member.id), row.id, coins, emoji ?? undefined))
      }

      const [message] = await decorate(pool, [toMessage(row)], secret)
      return { message }
    },
  )
}
