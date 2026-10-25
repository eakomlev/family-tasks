import { useEffect } from 'react'
import type { ChatSummary } from '@/api'

// Число на значке приложения: непрочитанное во всех чатах, кроме отключённых и убранных в архив. Сервер считает то же
// (`server/src/badge.ts`) и кладёт в каждое push-уведомление, пока приложение закрыто.
export const appBadgeCount = (chats: ChatSummary[] | undefined): number | undefined =>
  chats?.reduce((sum, c) => sum + (c.archived || c.muted ? 0 : c.unread), 0)

type BadgeNavigator = Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }

function apply(count: number) {
  const nav = navigator as BadgeNavigator
  if (!nav.setAppBadge) return
  const done = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.()
  done?.catch(() => {})
}

// Пока приложение открыто, число на значке (Badging API: установленное приложение на компьютере и на iPhone) совпадает с непрочитанным;
// пока список ещё не пришёл, значок не трогаем, при выходе (экран закрыт) убираем.
export function useAppBadge(count: number | undefined) {
  useEffect(() => {
    if (count !== undefined) apply(count)
  }, [count])
  useEffect(() => () => apply(0), [])
}
