import { describe, expect, it } from 'vitest'
import { parsePayload } from '../../src/contract.js'

// Те же примеры payload проверяет server (server/tests/api/outbox.test.ts): так контракт не расходится.
const email = { v: 1, kind: 'code', to: 'q@test.local', code: '123456', ttlMinutes: 10 }
const message = { title: 'Заголовок', body: 'Текст', url: '/tasks', tag: 'test' }
const push = { v: 1, subscriptionId: 'b5d1c1de-0000-4000-8000-000000000000', message }

describe('parsePayload', () => {
  it('принимает письмо с кодом и push из server', () => {
    expect(parsePayload('email', email)).toEqual({ ok: true, channel: 'email', payload: email })
    expect(parsePayload('push', push)).toEqual({ ok: true, channel: 'push', payload: push })
  })

  it('лишние поля отбрасывает', () => {
    const parsed = parsePayload('push', { ...push, extra: 1, message: { ...message, more: 2 } })
    expect(parsed).toEqual({ ok: true, channel: 'push', payload: push })
  })

  it('версия новее: не ошибка, строку надо оставить для обновлённого notifier', () => {
    expect(parsePayload('email', { ...email, v: 2 })).toEqual({ ok: false, reason: 'unsupported_version' })
  })

  it.each([
    ['не объект', 'email', 'text'],
    ['массив', 'push', []],
    ['без версии', 'email', { ...email, v: undefined }],
    ['версия 0', 'email', { ...email, v: 0 }],
    ['неизвестный вид письма', 'email', { ...email, kind: 'promo' }],
    ['адрес без @', 'email', { ...email, to: 'nobody' }],
    ['пустой код', 'email', { ...email, code: '' }],
    ['срок не число', 'email', { ...email, ttlMinutes: '10' }],
    ['срок ноль', 'email', { ...email, ttlMinutes: 0 }],
    ['push без подписки', 'push', { ...push, subscriptionId: '' }],
    ['push без сообщения', 'push', { ...push, message: null }],
    ['в сообщении нет заголовка', 'push', { ...push, message: { ...message, title: 5 } }],
    ['неизвестный канал', 'sms', email],
  ])('отклоняет: %s', (_name, channel, raw) => {
    const parsed = parsePayload(channel, raw)
    expect(parsed.ok).toBe(false)
    expect(parsed).toMatchObject({ reason: 'invalid' })
  })
})
