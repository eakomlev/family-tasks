import type { Greeting } from './types'

export function getGreeting(date: Date): Greeting {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return { text: 'Доброе утро', icon: '🌅' }
  if (hour >= 12 && hour < 18) return { text: 'Добрый день', icon: '☀️' }
  if (hour >= 18 && hour < 23) return { text: 'Добрый вечер', icon: '🌇' }
  return { text: 'Доброй ночи', icon: '🌙' }
}

// «Суббота, 10 октября»
export function formatToday(date: Date): string {
  const text = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}
