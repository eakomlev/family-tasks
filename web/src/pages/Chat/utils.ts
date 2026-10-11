import type { ChatSummary, Member } from '@/api'
import { addDays, todayIso } from '@/lib/date'

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

// Строка под названием чата: «Вы: …» для своих сообщений, в общем чате «Имя: …» для чужих, в личном просто текст.
export function chatPreview(chat: ChatSummary, me: string, members: Member[]): string {
  if (!chat.last) return 'Сообщений пока нет'
  const text = chat.last.text.replace(/\s+/g, ' ').trim()
  if (chat.last.senderId === me) return `Вы: ${text}`
  if (chat.id === 'family') {
    const name = members.find((m) => m.id === chat.last!.senderId)?.name
    return name ? `${name}: ${text}` : text
  }
  return text
}

// Названия чатов: общий и по имени собеседника.
export const chatTitle = (id: string, members: Member[]) =>
  id === 'family' ? FAMILY_TITLE : (members.find((m) => m.id === id)?.name ?? 'Чат')
