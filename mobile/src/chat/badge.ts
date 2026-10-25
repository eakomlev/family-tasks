import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'

// Пока приложение открыто, число на значке совпадает с непрочитанным (`appBadgeCount`); пока список ещё не пришёл, значок не трогаем.
// Без разрешения на уведомления вызов тихо ничего не делает (на iPhone значок без него не показывается).
export function useAppBadge(count: number | undefined) {
  useEffect(() => {
    if (count !== undefined) void Notifications.setBadgeCountAsync(count).catch(() => {})
  }, [count])
}
