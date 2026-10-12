const KEY = 'push-prompt-dismissed'
// после «Позже» плашка возвращается через неделю
export const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000

// Хранится только на устройстве; если хранилище недоступно (приватный режим), плашка просто показывается при каждом запуске.
export function isDismissed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(KEY))
    return Number.isFinite(at) && at > 0 && now - at < DISMISS_FOR_MS
  } catch {
    return false
  }
}

export function rememberDismissed(now = Date.now()) {
  try {
    localStorage.setItem(KEY, String(now))
  } catch {
    /* не критично */
  }
}
