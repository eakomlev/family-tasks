// Кэш фото из чатов в service worker (web/src/sw.ts). Файл фото неизменяем (id уникален), а подпись в адресе
// меняется раз в сутки, поэтому ключ кэша — путь без подписи: фото качается один раз, а не заново каждые сутки
// и не после того, как браузер вытеснил его из своего HTTP-кэша (на iPhone он маленький).
export const PHOTO_CACHE = 'chat-photos'

// Сколько фото держать на устройстве (превью и полные варианты вместе) и как долго.
export const PHOTO_CACHE_MAX_ENTRIES = 400
export const PHOTO_CACHE_MAX_AGE_SECONDS = 60 * 86400

const PHOTO_PATH = /^\/media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(full|thumb)$/

// Ключ кэша для адреса фото или null, если это не фото из чата.
export function photoCacheKey(url: URL, origin: string): string | null {
  if (url.origin !== origin || !PHOTO_PATH.test(url.pathname)) return null
  return url.origin + url.pathname
}

// Стереть кэш фото (выход и смена пользователя: фото чужих чатов на общем устройстве не оставляем).
export function clearPhotoCache() {
  if (typeof caches === 'undefined') return
  caches.delete(PHOTO_CACHE).catch(() => {
    /* не критично */
  })
}
