/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { PHOTO_CACHE, PHOTO_CACHE_MAX_AGE_SECONDS, PHOTO_CACHE_MAX_ENTRIES, photoCacheKey } from './lib/photoCache'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] }

// Тот же service worker, что генерировал плагин (кэш приложения, обновление без вопросов),
// плюс обработчики push-уведомлений.
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// адреса приложения отдают index.html (SPA), но API в кэш не попадает
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//, /^\/media\//] }))

// фото из чатов: сначала из своего кэша по пути без подписи (lib/photoCache.ts), в сеть только за новым фото.
// Доступ проверяется при выдаче адреса (подписанную ссылку получает только участник чата), кэш на устройстве стирается при выходе.
registerRoute(
  ({ url, request }) => request.method === 'GET' && photoCacheKey(url, self.location.origin) !== null,
  new CacheFirst({
    cacheName: PHOTO_CACHE,
    plugins: [
      { cacheKeyWillBeUsed: async ({ request }) => photoCacheKey(new URL(request.url), self.location.origin) ?? request },
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: PHOTO_CACHE_MAX_ENTRIES, maxAgeSeconds: PHOTO_CACHE_MAX_AGE_SECONDS, purgeOnQuotaError: true }),
    ],
  }),
)

interface PushPayload {
  title: string
  body: string
  // куда вести по нажатию
  url?: string
  tag?: string
  // число непрочитанного для значка приложения
  badge?: number
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = { title: 'Моя Семья', body: '' }
  try {
    payload = { ...payload, ...(event.data?.json() as Partial<PushPayload>) }
  } catch {
    // Chrome требует показать уведомление на каждый push, даже если данные не разобрались
  }

  // число на значке установленного приложения (Badging API, где оно есть: компьютеры и iPhone с приложением на экране «Домой»)
  const nav = self.navigator as WorkerNavigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  const badge = typeof payload.badge === 'number' ? (payload.badge > 0 ? nav.setAppBadge?.(payload.badge) : nav.clearAppBadge?.()) : undefined

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        data: { url: payload.url ?? '/' },
      }),
      badge?.catch(() => {}),
    ]),
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
