import { describe, expect, it, vi } from 'vitest'
import { classifyMailError, createMailProvider, renderCode } from '../../src/providers/mail.js'

const payload = { v: 1, kind: 'code', to: 'a@test.local', code: '123456', ttlMinutes: 10 } as const

describe('письмо с кодом', () => {
  it('тема и текст как раньше', () => {
    expect(renderCode(payload)).toEqual({
      subject: 'Код для входа: 123456',
      text: 'Ваш код для входа в «Мою семью»: 123456\n\nОн действует 10 минут. Если вы его не запрашивали, просто проигнорируйте это письмо.',
    })
  })

  it('отправляет через транспорт от нужного адреса', async () => {
    const sendMail = vi.fn(async () => ({}))
    const result = await createMailProvider({ sendMail }, 'Семья <from@test.local>')(payload)
    expect(result).toEqual({ kind: 'sent' })
    expect(sendMail).toHaveBeenCalledWith({ from: 'Семья <from@test.local>', to: 'a@test.local', ...renderCode(payload) })
  })

  it('ошибка транспорта превращается в итог, а не в исключение', async () => {
    const sendMail = vi.fn(async () => { throw Object.assign(new Error('boom'), { code: 'ETIMEDOUT' }) })
    const result = await createMailProvider({ sendMail }, 'x')(payload)
    expect(result).toEqual({ kind: 'retry', error: 'ETIMEDOUT boom' })
  })
})

describe('классификация ошибок SMTP', () => {
  it.each([
    ['сеть', { code: 'ECONNECTION', message: 'refused' }],
    ['таймаут', { code: 'ETIMEDOUT', message: 'x' }],
    ['временная 4xx', { responseCode: 451, message: 'try later' }],
    ['без кода', { message: 'что-то' }],
  ])('временная: %s', (_name, err) => {
    expect(classifyMailError(err).kind).toBe('retry')
  })

  it.each([
    ['5xx от сервера', { responseCode: 550, message: 'no such user' }],
    ['авторизация 535', { responseCode: 535, code: 'EAUTH', message: 'bad creds' }],
    ['неверный адрес', { code: 'EENVELOPE', message: 'No recipients' }],
  ])('постоянная: %s', (_name, err) => {
    expect(classifyMailError(err).kind).toBe('fail')
  })
})
