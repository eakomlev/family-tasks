import type { Href } from 'expo-router'

interface BackRouter {
  canGoBack(): boolean
  back(): void
  replace(href: Href): void
}

// Назад на экран, с которого пришли; если истории нет (открыли по ссылке или уведомлению), на запасной адрес
export function goBack(router: BackRouter, fallback: Href) {
  if (router.canGoBack()) router.back()
  else router.replace(fallback)
}
