import type { Role } from '@/lib/roles'
import type { Tab } from './types'

// порядок слева направо
export const TABS: Tab[] = [
  { path: '/my-day', label: 'Мой день', icon: 'day' },
  { path: '/tasks', label: 'Задачи', icon: 'tasks' },
  { path: '/chat', label: 'Чат', icon: 'chat' },
  { path: '/family', label: 'Семья', icon: 'family' },
]

// у ребёнка вкладки «Задачи» нет: его задания на «Моём дне»
export const tabsFor = (role: Role | undefined): Tab[] => (role === 'child' ? TABS.filter((tab) => tab.path !== '/tasks') : TABS)
