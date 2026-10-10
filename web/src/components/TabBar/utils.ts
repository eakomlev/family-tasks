import type { Tab } from './types'

// порядок слева направо
export const TABS: Tab[] = [
  { path: '/tasks', label: 'Задачи', icon: '✅' },
  { path: '/chat', label: 'Чат', icon: '💬' },
  { path: '/my-day', label: 'Мой день', icon: '☀️' },
  { path: '/family', label: 'Моя семья', icon: '👨‍👩‍👧' },
  { path: '/settings', label: 'Настройки', icon: '⚙️' },
]
