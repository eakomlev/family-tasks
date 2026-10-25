import { describe, expect, it } from 'vitest'
import type { ChatSummary } from '@/api'
import { appBadgeCount } from '@/chat/badgeCount'

const chat = (patch: Partial<ChatSummary>): ChatSummary => ({ id: 'family', last: null, unread: 0, muted: false, archived: false, readUpTo: null, ...patch }) as ChatSummary

describe('число на значке приложения', () => {
  it('сумма непрочитанного без отключённых и архивных чатов; пока списка нет, значения нет', () => {
    expect(appBadgeCount(undefined)).toBeUndefined()
    expect(appBadgeCount([])).toBe(0)
    expect(appBadgeCount([chat({ unread: 3 }), chat({ id: 'a', unread: 2 }), chat({ id: 'b', unread: 5, muted: true }), chat({ id: 'c', unread: 7, archived: true })])).toBe(5)
  })
})
