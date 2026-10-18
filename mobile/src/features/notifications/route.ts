// Куда вести нажатие на уведомление. Сервер кладёт в данные уведомления адрес экрана (`url`, как в веб-версии: /tasks, /chat/<чат>,
// /coins, /goals/<id>, /profile/notifications). Принимаем только внутренние адреса приложения: данные пришли по сети, и открыть чужую
// ссылку или другой раздел по ним нельзя.
export function routeFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const url = (data as { url?: unknown }).url
  if (typeof url !== 'string') return null
  // «/путь» без схемы и без «//» в начале (это был бы адрес на другой сайт); управляющих знаков быть не должно
  if (!url.startsWith('/') || url.startsWith('//') || url.length > 300 || /[\u0000-\u001f\\]/.test(url)) return null
  return url
}
