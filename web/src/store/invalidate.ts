import type { TagDescription } from '@reduxjs/toolkit/query'
import type { RealtimeEvent } from '@/realtime/types'
import { TAGS, type Tag } from './api'

// тег целиком (все записи этого вида) или с id (одна запись: расписание ребёнка, переписка чата)
export type TagItem = Tag | { type: Tag; id: string }

// Событие сокета → какие теги кэша устарели. В событии нет данных: активные экраны запросят их заново обычным запросом,
// где доступ проверяется как всегда, а неактивные записи просто удалятся и загрузятся при следующем открытии.
// Где у события есть адрес (ребёнок, чат), сбрасывается только он, остальные записи не трогаются.
export function tagsForEvent(event: RealtimeEvent): readonly TagItem[] {
  switch (event.type) {
    case 'tasks':
      return ['Tasks', 'Pending', 'Done']
    case 'members':
      return ['Me', 'Coins', 'Earned']
    case 'schedule':
      return [{ type: 'Schedule', id: event.memberId }]
    case 'trainings':
      return [{ type: 'Trainings', id: event.memberId }]
    case 'goals':
      return ['Goals']
    case 'events':
      return ['Events']
    case 'chat':
      return ['Chats', { type: 'Messages', id: event.chat }]
    case 'resync':
      return TAGS
  }
}

const keyOf = (tag: TagItem) => (typeof tag === 'string' ? tag : `${tag.type}:${tag.id}`)

// Склеивает инвалидации за короткое окно: пачка событий (например, при resync) даёт один проход, а не лавину запросов.
export function createInvalidator(flush: (tags: TagDescription<Tag>[]) => void, delayMs = 200) {
  const pending = new Map<string, TagItem>()
  let timer: ReturnType<typeof setTimeout> | undefined
  return (tags: readonly TagItem[]) => {
    tags.forEach((tag) => pending.set(keyOf(tag), tag))
    if (timer) return
    timer = setTimeout(() => {
      timer = undefined
      const batch = [...pending.values()]
      pending.clear()
      flush(batch)
    }, delayMs)
  }
}
