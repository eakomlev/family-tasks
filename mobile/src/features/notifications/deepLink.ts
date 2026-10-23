import { routeFromNotificationData } from './route'

// Куда на самом деле вести нажатие на уведомление. Сервер и планировщик кладут в уведомление адрес «как в вебе» (веб-версия и приложение
// получают одно и то же), а экраны приложения называются иногда иначе: здесь адрес переводится в маршрут приложения.
//   /my-day                  → «Мой день» (корень приложения)
//   /chat/event-<id>         → страница события, вкладка «Чат»
//   /tasks/<id>?date=…       → задание (нужное вхождение повторяющегося)
//   /chat/…, /family/…, /goals/…, /coins, /profile/…, /calendar/… → как есть
// Незнакомый адрес не открываем (приложение просто откроется на том экране, где было), а не показываем «экран не найден».

export interface NotificationTarget {
  // маршрут приложения (с query)
  href: string
  // корень одного из главных табов: переключаемся на него, а не кладём ещё один экран в стек
  tab: boolean
}

const SECTIONS = ['tasks', 'chat', 'family', 'profile', 'coins', 'goals', 'calendar']
const TAB_ROOTS = new Set(['/', '/tasks', '/chat', '/family'])
const EVENT_CHAT = /^\/chat\/event-([0-9a-f-]{36})\/?$/i

export function targetForPath(url: string): NotificationTarget | null {
  const queryAt = url.search(/[?#]/)
  const path = queryAt === -1 ? url : url.slice(0, queryAt)
  const rest = queryAt === -1 ? '' : url.slice(queryAt)
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path

  if (clean === '/my-day' || clean === '/') return { href: '/', tab: true }

  const event = EVENT_CHAT.exec(clean)
  if (event) return { href: `/calendar/events/${event[1]}?tab=chat`, tab: false }

  const section = clean.split('/')[1]
  if (!SECTIONS.includes(section)) return null
  return { href: `${clean}${rest}`, tab: TAB_ROOTS.has(clean) }
}

// Из данных уведомления (`data.url`): уже проверенный внутренний адрес превращается в маршрут приложения
export function notificationTarget(data: unknown): NotificationTarget | null {
  const url = routeFromNotificationData(data)
  return url ? targetForPath(url) : null
}
