import type { ServerEvent } from '@/realtime/types'
import { describe, expect, it } from 'vitest'
import { nextDelay, parseMessage, socketUrl } from '@/realtime/utils'

describe('nextDelay', () => {
  it('растёт вдвое и упирается в 30 секунд', () => {
    const mid = () => 0.5 // без добавки: множитель ровно 1
    expect([0, 1, 2, 3, 4, 5, 6, 10].map((a) => nextDelay(a, mid))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000])
  })

  it('случайная добавка в пределах ±25%', () => {
    expect(nextDelay(2, () => 0)).toBe(3000)
    expect(nextDelay(2, () => 1)).toBe(5000)
  })
})

describe('socketUrl', () => {
  it('ws для http, wss для https', () => {
    expect(socketUrl('http://localhost:5173')).toBe('ws://localhost:5173/api/ws')
    expect(socketUrl('https://family.example.com')).toBe('wss://family.example.com/api/ws')
  })
})

describe('parseMessage', () => {
  it('известные события', () => {
    expect(parseMessage('{"type":"ready"}')).toEqual({ type: 'ready' })
    expect(parseMessage('{"type":"tasks"}')).toEqual({ type: 'tasks' })
    expect(parseMessage('{"type":"members"}')).toEqual({ type: 'members' })
    expect(parseMessage('{"type":"schedule","memberId":"m1"}')).toEqual({ type: 'schedule', memberId: 'm1' })
    expect(parseMessage('{"type":"trainings","memberId":"m2"}')).toEqual({ type: 'trainings', memberId: 'm2' })
    expect(parseMessage('{"type":"chat","chat":"family"}')).toEqual({ type: 'chat', chat: 'family' })
  })

  it('мусор отбрасывается', () => {
    expect(parseMessage('не json')).toBeNull()
    expect(parseMessage('{"type":"неизвестно"}')).toBeNull()
    expect(parseMessage('{"type":"schedule"}')).toBeNull()
    expect(parseMessage('{"type":"schedule","memberId":5}')).toBeNull()
    expect(parseMessage('{"type":"chat"}')).toBeNull()
    expect(parseMessage('{"type":"chat","chat":7}')).toBeNull()
    expect(parseMessage('null')).toBeNull()
    expect(parseMessage(new ArrayBuffer(2))).toBeNull()
  })

  it('лишние поля не пропускаются дальше', () => {
    expect(parseMessage('{"type":"tasks","secret":"x"}')).toEqual({ type: 'tasks' })
  })
})

describe('все события сервера доходят до кэша', () => {
  it('сообщения без данных и с адресом разбираются (раньше games, events и goals молча отбрасывались)', () => {
    expect(parseMessage('{"type":"games"}')).toEqual({ type: 'games' })
    expect(parseMessage('{"type":"events"}')).toEqual({ type: 'events' })
    expect(parseMessage('{"type":"goals","memberId":"m1"}')).toEqual({ type: 'goals', memberId: 'm1' })
    expect(parseMessage('{"type":"goals"}')).toBeNull()
  })

  it('мост подписан на каждый вид события: новый вид без подписки не обновит экран', async () => {
    const { TOPICS } = await import('@/store/topics')
    const all = { tasks: 1, members: 1, schedule: 1, trainings: 1, goals: 1, events: 1, chat: 1, games: 1 } satisfies Record<ServerEvent['type'], 1>
    expect(TOPICS).toEqual(expect.arrayContaining(Object.keys(all) as ServerEvent['type'][]))
  })
})
