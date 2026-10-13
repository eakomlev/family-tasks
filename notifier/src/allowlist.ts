// Адреса, на которые разрешено слать push. Список повторяет server/src/push.ts: подписку проверяет server при
// сохранении, а запрос по адресу делает notifier, поэтому проверяем и здесь (защита от SSRF в два слоя).
// Для тестов хосты можно добавить через PUSH_ALLOWED_HOSTS (через запятую).
const ALLOWED_SUFFIXES = ['.googleapis.com', '.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com']

export function isAllowedEndpoint(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const extra = (process.env.PUSH_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  return extra.includes(url.hostname) || ALLOWED_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
}
