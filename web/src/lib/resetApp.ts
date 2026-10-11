// Сброс приложения на этом устройстве: отключает service worker, чистит его кэши и перезагружает страницу.
// Данные входа (IndexedDB) и тема не трогаем: после сброса остаётся войти не придётся.
export async function resetApp(): Promise<void> {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(registrations.map((r) => r.unregister()))
    if ('caches' in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
  } catch {
    /* перезагрузим в любом случае */
  }
  window.location.reload()
}
