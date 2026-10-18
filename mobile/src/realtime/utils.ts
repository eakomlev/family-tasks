import { API_URL } from '@/lib/config'
import type { ServerEvent } from './types'

// закрытие сервером из-за неверной или завершённой сессии: переподключаться бессмысленно
export const CLOSE_UNAUTHORIZED = 4401

const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30_000

// Пауза перед очередной попыткой подключиться: 1, 2, 4 ... до 30 секунд, плюс случайная добавка,
// чтобы после перезапуска сервера все устройства не пришли в одну секунду.
export function nextDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt)
  return Math.round(base * (0.75 + random() * 0.5))
}

export function socketUrl(base: string = API_URL): string {
  return `${base.replace(/^http/, 'ws')}/api/ws`
}

// Разбирает сообщение сервера; всё непонятное отбрасывается.
export function parseMessage(data: unknown): ServerEvent | { type: 'ready' } | null {
  if (typeof data !== 'string') return null
  let message: any
  try {
    message = JSON.parse(data)
  } catch {
    return null
  }
  switch (message?.type) {
    case 'ready':
    case 'tasks':
    case 'members':
      return { type: message.type }
    case 'chat':
      return typeof message.chat === 'string' ? { type: 'chat', chat: message.chat } : null
    case 'schedule':
    case 'trainings':
      return typeof message.memberId === 'string' ? { type: message.type, memberId: message.memberId } : null
    default:
      return null
  }
}
