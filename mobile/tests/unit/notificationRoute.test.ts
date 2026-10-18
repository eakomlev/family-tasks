import { describe, expect, it } from 'vitest'
import { routeFromNotificationData } from '@/features/notifications/route'

describe('куда вести нажатие на уведомление', () => {
  it('внутренние адреса приложения принимаются как есть', () => {
    expect(routeFromNotificationData({ url: '/chat/family' })).toBe('/chat/family')
    expect(routeFromNotificationData({ url: '/tasks/abc?date=2026-10-12' })).toBe('/tasks/abc?date=2026-10-12')
    expect(routeFromNotificationData({ url: '/profile/notifications', tag: 'test' })).toBe('/profile/notifications')
  })

  it.each([
    ['чужой сайт', { url: 'https://evil.example/x' }],
    ['адрес без схемы на другой сайт', { url: '//evil.example/x' }],
    ['другая схема', { url: 'familytasks://x' }],
    ['обратная косая черта', { url: '/\\evil.example' }],
    ['управляющие знаки', { url: '/chat/\u0000x' }],
    ['слишком длинный', { url: `/${'a'.repeat(400)}` }],
    ['не строка', { url: 5 }],
    ['нет адреса', {}],
    ['нет данных', null],
    ['не объект', 'text'],
  ])('отбрасывается: %s', (_name, data) => {
    expect(routeFromNotificationData(data)).toBeNull()
  })
})
