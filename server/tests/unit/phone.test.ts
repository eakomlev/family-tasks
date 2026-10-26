import { describe, expect, it } from 'vitest'
import { normalizePhone, parseContact } from '../../src/contact.js'

describe('normalizePhone', () => {
  it.each([
    ['+79112223344', '+79112223344'],
    ['89112223344', '+79112223344'],
    ['79112223344', '+79112223344'],
    ['8 (911) 222-33-44', '+79112223344'],
    ['+7 911 222 33 44', '+79112223344'],
    ['  +7(911)222-33-44 ', '+79112223344'],
    ['+7.911.222.33.44', '+79112223344'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each([
    ['пусто', ''],
    ['слишком короткий', '+7911222'],
    ['слишком длинный', '+791122233445'],
    ['городской номер', '+74951234567'],
    ['8-800', '88001234567'],
    ['зарубежный', '+380501234567'],
    ['буквы', '+7911abc3344'],
    ['без кода страны', '9112223344'],
  ])('отвергает: %s', (_name, input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('parseContact', () => {
  it('email приводится к нижнему регистру, ключ кода это сам адрес', () => {
    expect(parseContact({ email: ' Mama@Mail.Test ' })).toEqual({ ok: true, contact: { kind: 'email', value: 'mama@mail.test', key: 'mama@mail.test', column: 'email' } })
  })

  it('телефон нормализуется, ключ кода с префиксом tel: (не пересекается с email)', () => {
    expect(parseContact({ phone: '8 911 222-33-44' })).toEqual({ ok: true, contact: { kind: 'phone', value: '+79112223344', key: 'tel:+79112223344', column: 'phone' } })
  })

  it('нужен ровно один способ связи', () => {
    expect(parseContact({})).toEqual({ ok: false, error: 'contact_required' })
    expect(parseContact({ email: 'a@b.test', phone: '+79112223344' })).toEqual({ ok: false, error: 'contact_required' })
  })

  it('неверный номер отдельная ошибка', () => {
    expect(parseContact({ phone: '+380501234567' })).toEqual({ ok: false, error: 'invalid_phone' })
  })
})
