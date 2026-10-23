import { describe, expect, it } from 'vitest'
import { notificationTarget, targetForPath } from '@/features/notifications/deepLink'

const EVENT = '0f3c1e52-9b1a-4c3e-8f1d-2a4b6c8d0e1f'

// Все адреса, которые сервер и планировщик кладут в уведомления (server/src/tasks/text.ts, chat.ts, goals.ts, push.ts, scheduler/src/messages.ts)
describe('адреса из уведомлений превращаются в маршруты приложения', () => {
  it.each([
    ['«Мой день» (уроки, тренировки)', '/my-day', { href: '/', tab: true }],
    ['общий чат', '/chat/family', { href: '/chat/family', tab: false }],
    ['личный чат', '/chat/0f3c1e52-9b1a-4c3e-8f1d-000000000001', { href: '/chat/0f3c1e52-9b1a-4c3e-8f1d-000000000001', tab: false }],
    ['чат события: страница события, вкладка «Чат»', `/chat/event-${EVENT}`, { href: `/calendar/events/${EVENT}?tab=chat`, tab: false }],
    ['задание', '/tasks/abc', { href: '/tasks/abc', tab: false }],
    ['нужное вхождение повторяющегося задания', '/tasks/abc?date=2026-10-12', { href: '/tasks/abc?date=2026-10-12', tab: false }],
    ['монеты', '/coins', { href: '/coins', tab: false }],
    ['цель', '/goals/g1', { href: '/goals/g1', tab: false }],
    ['игра', '/games/00000000-0000-4000-8000-000000000001', { href: '/games/00000000-0000-4000-8000-000000000001', tab: false }],
    ['профиль именинника', '/profile', { href: '/profile', tab: false }],
    ['уведомления в профиле', '/profile/notifications', { href: '/profile/notifications', tab: false }],
    ['страница члена семьи', '/family/m1', { href: '/family/m1', tab: false }],
  ])('%s', (_name, url, expected) => {
    expect(targetForPath(url)).toEqual(expected)
  })

  it('корни главных табов переключают вкладку', () => {
    expect(targetForPath('/tasks')).toEqual({ href: '/tasks', tab: true })
    expect(targetForPath('/chat/')).toEqual({ href: '/chat', tab: true })
    expect(targetForPath('/family')).toEqual({ href: '/family', tab: true })
    expect(targetForPath('/')).toEqual({ href: '/', tab: true })
  })

  it('незнакомый раздел не открывается', () => {
    expect(targetForPath('/settings')).toBeNull()
    expect(targetForPath('/nope/1')).toBeNull()
    expect(targetForPath('/share')).toBeNull()
  })
})

describe('notificationTarget', () => {
  it('берёт адрес из данных уведомления', () => {
    expect(notificationTarget({ url: '/my-day', tag: 'lessons' })).toEqual({ href: '/', tab: true })
  })

  it('чужие и пустые адреса отбрасываются', () => {
    expect(notificationTarget({ url: 'https://evil.example/x' })).toBeNull()
    expect(notificationTarget({ url: '//evil.example' })).toBeNull()
    expect(notificationTarget(null)).toBeNull()
    expect(notificationTarget({})).toBeNull()
  })
})
