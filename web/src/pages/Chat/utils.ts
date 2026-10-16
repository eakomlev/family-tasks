import type { ChatSummary, Member } from '@/api'
import { addDays, todayIso } from '@/lib/date'
import { memberLabel, type Role } from '@/lib/roles'
import { messageStatus, type MessageStatus } from '@/pages/ChatRoom/utils'

export const FAMILY_TITLE = 'Общий чат'

// Время последнего сообщения в списке: сегодня «14:05», вчера «Вчера», раньше «12 окт.».
export function formatChatTime(iso: string, now: Date): string {
  const at = new Date(iso)
  const day = todayIso(at)
  const today = todayIso(now)
  if (day === today) return at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (day === addDays(today, -1)) return 'Вчера'
  return at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// Превью последнего сообщения по частям: подпись («Вы:», имя автора в общем чате) и текст.
export function chatPreviewParts(chat: ChatSummary, me: string, members: Member[], viewerRole: Role): { prefix?: string; mine: boolean; text: string } {
  if (!chat.last) return { text: 'Сообщений пока нет', mine: false }
  const last = chat.last
  const count = last.media?.length ?? 0
  // сообщение с фото: «📷 Фото», «📷 3 фото» или «📷 подпись»
  const caption = (last.caption ?? '').replace(/\s+/g, ' ').trim()
  const text = count > 0 ? `📷 ${caption || (count === 1 ? 'Фото' : `${count} фото`)}` : last.text.replace(/\s+/g, ' ').trim()
  if (chat.last.senderId === me) return { prefix: 'Вы:', mine: true, text }
  if (chat.id === 'family') {
    const sender = members.find((m) => m.id === chat.last!.senderId)
    const name = sender && memberLabel(sender, viewerRole)
    return name ? { prefix: `${name}:`, mine: false, text } : { mine: false, text }
  }
  return { mine: false, text }
}

// Статус моего последнего сообщения для списка (галочки рядом со временем); null, если последнее сообщение не моё или сервер не прислал readUpTo.
export function lastMessageStatus(chat: ChatSummary, me: string): MessageStatus | null {
  if (!chat.last || chat.last.senderId !== me || chat.readUpTo === undefined) return null
  return messageStatus(chat.last, chat.readUpTo)
}

// Строка под названием чата одной строкой: «Вы: …» для своих сообщений, в общем чате «Имя: …» для чужих, в личном просто текст.
export function chatPreview(chat: ChatSummary, me: string, members: Member[], viewerRole: Role): string {
  const { prefix, text } = chatPreviewParts(chat, me, members, viewerRole)
  return prefix ? `${prefix} ${text}` : text
}

// Названия чатов: общий и по имени собеседника.
export function chatTitle(id: string, members: Member[], viewerRole: Role): string {
  if (id === 'family') return FAMILY_TITLE
  const member = members.find((m) => m.id === id)
  return member ? memberLabel(member, viewerRole) : 'Чат'
}
