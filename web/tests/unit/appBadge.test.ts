import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChatSummary } from '@/api'
import { appBadgeCount, useAppBadge } from '@/chat/badge'

const chat = (patch: Partial<ChatSummary>): ChatSummary => ({ id: 'family', last: null, unread: 0, muted: false, archived: false, readUpTo: null, ...patch }) as ChatSummary

describe('число на значке приложения', () => {
  it('сумма непрочитанного без отключённых и архивных чатов; пока списка нет, значения нет', () => {
    expect(appBadgeCount(undefined)).toBeUndefined()
    expect(appBadgeCount([])).toBe(0)
    expect(appBadgeCount([chat({ unread: 3 }), chat({ id: 'a', unread: 2 }), chat({ id: 'b', unread: 5, muted: true }), chat({ id: 'c', unread: 7, archived: true })])).toBe(5)
  })
})

describe('useAppBadge', () => {
  const setAppBadge = vi.fn().mockResolvedValue(undefined)
  const clearAppBadge = vi.fn().mockResolvedValue(undefined)
  beforeEach(() => {
    setAppBadge.mockClear()
    clearAppBadge.mockClear()
    Object.defineProperty(navigator, 'setAppBadge', { value: setAppBadge, configurable: true })
    Object.defineProperty(navigator, 'clearAppBadge', { value: clearAppBadge, configurable: true })
  })
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'setAppBadge')
    Reflect.deleteProperty(navigator, 'clearAppBadge')
  })

  it('ставит число, при нуле снимает, пока числа нет, не трогает, при закрытии снимает', () => {
    const { rerender, unmount } = renderHook(({ count }: { count: number | undefined }) => useAppBadge(count), { initialProps: { count: undefined as number | undefined } })
    expect(setAppBadge).not.toHaveBeenCalled()
    expect(clearAppBadge).not.toHaveBeenCalled()
    rerender({ count: 4 })
    expect(setAppBadge).toHaveBeenLastCalledWith(4)
    rerender({ count: 0 })
    expect(clearAppBadge).toHaveBeenCalledTimes(1)
    unmount()
    expect(clearAppBadge).toHaveBeenCalledTimes(2)
  })

  it('там, где значка нет (Badging API не поддерживается), ничего не падает', () => {
    Reflect.deleteProperty(navigator, 'setAppBadge')
    expect(() => renderHook(() => useAppBadge(3)).unmount()).not.toThrow()
  })
})
