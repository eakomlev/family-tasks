import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsePayload } from '../../src/contract.js'

// Общий образец (contracts/outbox-v1.json) проверяет и server (server/tests/api/outbox.test.ts): так контракт не расходится.
const sample = JSON.parse(readFileSync(new URL('../../../contracts/outbox-v1.json', import.meta.url), 'utf8'))
const { email, emailInvite, push, message } = sample

describe('parsePayload', () => {
  it('принимает письмо с кодом и push из server', () => {
    expect(parsePayload('email', email)).toEqual({ ok: true, channel: 'email', payload: email })
    expect(parsePayload('push', push)).toEqual({ ok: true, channel: 'push', payload: push })
  })

  it('принимает письмо-приглашение с ссылкой', () => {
    expect(parsePayload('email', emailInvite)).toEqual({ ok: true, channel: 'email', payload: emailInvite })
  })

  it('письмо-приглашение без имени или с чужой ссылкой отвергается', () => {
    expect(parsePayload('email', { ...emailInvite, inviterName: '' })).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parsePayload('email', { ...emailInvite, link: 'javascript:alert(1)' })).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parsePayload('email', { ...emailInvite, kind: 'unknown' })).toMatchObject({ ok: false, reason: 'invalid' })
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
