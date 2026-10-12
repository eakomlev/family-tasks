import type { RealtimeEvent } from '@/realtime/types'
import { TAGS, type Tag } from './api'

// Событие сокета → какие теги кэша устарели. В событии нет данных: активные экраны запросят их заново обычным запросом,
// где доступ проверяется как всегда, а неактивные записи просто удалятся и загрузятся при следующем открытии.
// Позже (фазы 2-5) теги получат id (memberId, чат), чтобы инвалидировалось точечно.
export function tagsForEvent(event: RealtimeEvent): readonly Tag[] {
  switch (event.type) {
    case 'tasks':
      return ['Tasks', 'Pending', 'Done']
    case 'members':
      return ['Me', 'Coins', 'Earned']
    case 'schedule':
      return ['Schedule']
    case 'trainings':
      return ['Trainings']
    case 'goals':
      return ['Goals']
    case 'chat':
      return ['Chats', 'Messages']
    case 'resync':
      return TAGS
  }
}

// Склеивает инвалидации за короткое окно: пачка событий (например, при resync) даёт один проход, а не лавину запросов.
export function createInvalidator(flush: (tags: Tag[]) => void, delayMs = 200) {
  const pending = new Set<Tag>()
  let timer: ReturnType<typeof setTimeout> | undefined
  return (tags: readonly Tag[]) => {
    tags.forEach((tag) => pending.add(tag))
    if (timer) return
    timer = setTimeout(() => {
      timer = undefined
      const batch = [...pending]
      pending.clear()
      flush(batch)
    }, delayMs)
  }
}
