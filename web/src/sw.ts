/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] }

// Тот же service worker, что генерировал плагин (кэш приложения, обновление без вопросов),
// плюс обработчики push-уведомлений.
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// адреса приложения отдают index.html (SPA), но API в кэш не попадает
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

interface PushPayload {
  title: string
  body: string
  // куда вести по нажатию
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = { title: 'Моя Семья', body: '' }
  try {
    payload = { ...payload, ...(event.data?.json() as Partial<PushPayload>) }
  } catch {
    // Chrome требует показать уведомление на каждый push, даже если данные не разобрались
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data?.url as string | undefined) ?? '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // если приложение уже открыто, показываем его и переходим на нужную страницу
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus()
          await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
