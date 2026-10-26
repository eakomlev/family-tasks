import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { parsePayload } from '../../src/contract.js'
import { classifySmsAnswer, createSmsProvider, renderSms, type Fetcher } from '../../src/providers/sms.js'

const { sms } = JSON.parse(readFileSync(new URL('../../../contracts/outbox-v1.json', import.meta.url), 'utf8'))
const config = { email: 'me@test.local', apiKey: 'key-123', sign: 'SMS Aero' }

const answer = (status: number, body: object | string) => ({ status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })

describe('SMS: разбор очереди и текст', () => {
  it('принимает SMS из образца контракта и отвергает чужие номера', () => {
    expect(parsePayload('sms', sms)).toEqual({ ok: true, channel: 'sms', payload: sms })
    expect(parsePayload('sms', { ...sms, to: '+380501234567' })).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parsePayload('sms', { ...sms, to: '79112223344' })).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parsePayload('sms', { ...sms, code: '' })).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parsePayload('sms', { ...sms, kind: 'invite' })).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parsePayload('sms', { ...sms, v: 2 })).toEqual({ ok: false, reason: 'unsupported_version' })
  })

  it('текст называет сервис и не длиннее одного сегмента кириллицы (70 знаков)', () => {
    const text = renderSms(sms)
    expect(text).toContain('Моя Семья')
    expect(text).toContain('123456')
    expect(text.length).toBeLessThanOrEqual(70)
  })
})

describe('SMS Aero: ответы шлюза', () => {
  it('success: true значит принято', () => {
    expect(classifySmsAnswer(200, JSON.stringify({ success: true, data: { id: 1, status: 8 } }))).toEqual({ kind: 'sent' })
  })

  it('стоимость сообщения из ответа попадает в итог отправки', () => {
    expect(classifySmsAnswer(200, JSON.stringify({ success: true, data: { cost: 9.89 } }))).toEqual({ kind: 'sent', cost: 9.89 })
    expect(classifySmsAnswer(200, JSON.stringify({ success: true, data: { cost: '3.5' } }))).toEqual({ kind: 'sent', cost: 3.5 })
    expect(classifySmsAnswer(200, JSON.stringify({ success: true, data: { cost: 'abc' } }))).toEqual({ kind: 'sent' })
  })

  it('нехватка денег, неверный ключ, ограничения и сбои шлюза временные', () => {
    expect(classifySmsAnswer(402, '{"success":false,"message":"Not enough money"}')).toMatchObject({ kind: 'retry' })
    expect(classifySmsAnswer(401, '{"success":false}')).toMatchObject({ kind: 'retry' })
    expect(classifySmsAnswer(429, '')).toMatchObject({ kind: 'retry' })
    expect(classifySmsAnswer(502, '<html>bad gateway</html>')).toMatchObject({ kind: 'retry' })
  })

  it('ошибка проверки данных (номер, подпись, текст) постоянная, причина в тексте', () => {
    const out = classifySmsAnswer(400, '{"success":false,"data":{"number":["bad"]},"message":"Validation error."}')
    expect(out).toMatchObject({ kind: 'fail' })
    expect((out as { error: string }).error).toContain('Validation error')
  })

  it('200 без success: true не считается отправленным', () => {
    expect(classifySmsAnswer(200, '{"success":false,"message":"nope"}')).toMatchObject({ kind: 'retry' })
  })
})

describe('провайдер SMS Aero', () => {
  it('отправляет GET с цифрами номера, подписью и текстом; ключ в заголовке, а не в адресе', async () => {
    const fetcher = vi.fn<Fetcher>(async () => answer(200, { success: true }))
    const send = createSmsProvider(config, fetcher)
    expect(await send(sms)).toEqual({ kind: 'sent' })

    const [url, init] = fetcher.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://gate.smsaero.ru/v2/sms/send')
    expect(parsed.searchParams.get('number')).toBe('79112223344')
    expect(parsed.searchParams.get('sign')).toBe('SMS Aero')
    expect(parsed.searchParams.get('text')).toBe(renderSms(sms))
    expect(url).not.toContain('key-123')
    expect(init.headers.authorization).toBe(`Basic ${Buffer.from('me@test.local:key-123').toString('base64')}`)
  })

  it('сбой сети временный', async () => {
    const send = createSmsProvider(config, async () => {
      throw new Error('socket hang up')
    })
    expect(await send(sms)).toMatchObject({ kind: 'retry', error: expect.stringContaining('socket hang up') })
  })
})
