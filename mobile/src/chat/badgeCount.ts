import type { ChatSummary } from '@/api'

// Число на значке приложения: непрочитанное во всех чатах, кроме отключённых и убранных в архив. Сервер считает то же
// (`server/src/badge.ts`) и кладёт в каждое push-уведомление, пока приложение закрыто.
export const appBadgeCount = (chats: ChatSummary[] | undefined): number | undefined =>
  chats?.reduce((sum, c) => sum + (c.archived || c.muted ? 0 : c.unread), 0)
