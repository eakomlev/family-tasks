import type { ChatMessage } from '@/api'
import { addDays, formatDayMonth, todayIso } from '@/lib/date'

export const MAX_LENGTH = 2000

// Сливает свежую страницу сообщений с уже загруженными: более старые, подгруженные ранее, остаются.
// Нет общих сообщений: свежая страница заменяет всё (между ними мог образоваться пропуск, который не склеить).
export function mergeLatest(
  current: ChatMessage[],
  latest: ChatMessage[],
  latestHasMore: boolean,
  currentHasMore: boolean,
): { messages: ChatMessage[]; hasMore: boolean } {
  const idx = latest.length > 0 ? current.findIndex((m) => m.id === latest[0].id) : -1
  if (idx > 0) return { messages: [...current.slice(0, idx), ...latest], hasMore: currentHasMore }
  return { messages: latest, hasMore: latestHasMore }
}

// Добавляет своё только что отправленное сообщение, если оно ещё не пришло с сервера.
export const appendMessage = (current: ChatMessage[], message: ChatMessage): ChatMessage[] =>
  current.some((m) => m.id === message.id) ? current : [...current, message]

// Подпись дня: «Сегодня», «Вчера» или «12 октября».
export function dayLabel(iso: string, now: Date): string {
  const day = todayIso(new Date(iso))
  const today = todayIso(now)
  if (day === today) return 'Сегодня'
  if (day === addDays(today, -1)) return 'Вчера'
  return formatDayMonth(day)
}

export interface DayGroup {
  key: string
  label: string
  messages: ChatMessage[]
}

// Группирует сообщения по дням (местным), порядок сохраняется.
export function groupByDay(messages: ChatMessage[], now: Date): DayGroup[] {
  const groups: DayGroup[] = []
  for (const message of messages) {
    const key = todayIso(new Date(message.createdAt))
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.messages.push(message)
    else groups.push({ key, label: dayLabel(message.createdAt, now), messages: [message] })
  }
  return groups
}

// Статус своего сообщения: «прочитано», когда остальные участники чата прочитали его (readUpTo не раньше времени сообщения), иначе «отправлено».
export type MessageStatus = 'sent' | 'read'

export const messageStatus = (message: ChatMessage, readUpTo: string | null): MessageStatus =>
  readUpTo !== null && message.createdAt <= readUpTo ? 'read' : 'sent'

export const formatMessageTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

// Текст можно отправить: не пустой после обрезки и не длиннее предела.
export const canSend = (text: string) => text.trim().length > 0 && text.trim().length <= MAX_LENGTH

export interface ReactionGroup {
  emoji: string
  count: number
}

// Реакции под сообщением: одинаковые склеиваются в одну с числом, порядок по первому появлению.
export function groupReactions(reactions: { emoji: string }[]): ReactionGroup[] {
  const groups: ReactionGroup[] = []
  for (const { emoji } of reactions) {
    const group = groups.find((g) => g.emoji === emoji)
    if (group) group.count++
    else groups.push({ emoji, count: 1 })
  }
  return groups
}

// Сколько монет всего начислено за сообщение.
export const totalCoins = (awards: { amount: number }[]) => awards.reduce((sum, a) => sum + a.amount, 0)

// Подменяет сообщение в списке его обновлённой версией (после реакции или начисления).
export const replaceMessage = (list: ChatMessage[], message: ChatMessage): ChatMessage[] =>
  list.map((m) => (m.id === message.id ? message : m))

// Подпись шапки личного чата: «сейчас в чате» или «был(а) сегодня в 14:05, вчера в 09:30, 12 октября в 18:00».
export function visitLabel(peer: { viewing: boolean; lastVisitAt: string | null } | null, now: Date): string | null {
  if (!peer) return null
  if (peer.viewing) return 'Сейчас в чате'
  if (!peer.lastVisitAt) return null
  const time = new Date(peer.lastVisitAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const day = dayLabel(peer.lastVisitAt, now)
  return `Последний визит: ${day === 'Сегодня' ? 'сегодня' : day === 'Вчера' ? 'вчера' : day} в ${time}`
}
