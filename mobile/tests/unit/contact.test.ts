import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api'
import { contactBody, describeContact, emptyContact, formatPhone, isValidContact, normalizePhone, trimContact } from '@/lib/contact'
import { describeCodeError, describeResendError } from '@/lib/errors'
import { describeSignupError } from '@/features/auth/signupErrors'

describe('normalizePhone', () => {
  it.each([
    ['+79112223344', '+79112223344'],
    ['89112223344', '+79112223344'],
    ['79112223344', '+79112223344'],
    ['8 (911) 222-33-44', '+79112223344'],
    ['+7 911 222 33 44', '+79112223344'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each(['', '+7911222', '+791122233445', '+74951234567', '88001234567', '+380501234567', '+7911abc3344', '9112223344'])('отвергает %j', (input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('контакт', () => {
  it('в запрос идёт email без пробелов или номер в нормализованном виде', () => {
    expect(contactBody({ kind: 'email', value: ' a@b.co ' })).toEqual({ email: 'a@b.co' })
    expect(contactBody({ kind: 'phone', value: '8 911 222-33-44' })).toEqual({ phone: '+79112223344' })
  })

  it('показ: номер читаемо, email как есть', () => {
    expect(formatPhone('89112223344')).toBe('+7 911 222-33-44')
    expect(describeContact({ kind: 'phone', value: '+79112223344' })).toBe('+7 911 222-33-44')
    expect(describeContact({ kind: 'email', value: ' a@b.co ' })).toBe('a@b.co')
  })

  it('проверка по виду контакта и пустой контакт', () => {
    expect(isValidContact({ kind: 'phone', value: '+7 911 222-33-44' })).toBe(true)
    expect(isValidContact({ kind: 'phone', value: 'a@b.co' })).toBe(false)
    expect(isValidContact({ kind: 'email', value: 'a@b.co' })).toBe(true)
    expect(isValidContact(emptyContact())).toBe(false)
    expect(emptyContact('phone')).toEqual({ kind: 'phone', value: '' })
    expect(trimContact({ kind: 'email', value: ' x ' })).toEqual({ kind: 'email', value: 'x' })
  })
})

describe('тексты ошибок для SMS', () => {
  it('отправка и повторная отправка кода', () => {
    expect(describeCodeError(new ApiError(503, 'sms_busy'))).toMatch(/SMS.*перегружен/)
    expect(describeCodeError(new ApiError(400, 'invalid_phone'))).toMatch(/российский мобильный номер/)
    expect(describeResendError(new ApiError(503, 'sms_busy'))).toMatch(/SMS.*перегружен/)
  })

  it('номер уже есть в семье возвращает к данным', () => {
    expect(describeSignupError(new ApiError(409, 'phone_taken'))).toMatchObject({ backToDetails: true, text: expect.stringMatching(/номер уже используется/) })
  })
})
