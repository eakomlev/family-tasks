import { describe, expect, it } from 'vitest'
import { formatPhoneInput, normalizePhone } from '@/lib/contact'
describe('formatPhoneInput', () => {
  it.each([
    ['', ''],
    ['9', '+7 9'],
    ['911', '+7 911'],
    ['9111', '+7 911 1'],
    ['9111234567', '+7 911 123-45-67'],
    ['89111234567', '+7 911 123-45-67'],
    ['79111234567', '+7 911 123-45-67'],
    ['+7 (911) 123-45-67', '+7 911 123-45-67'],
    ['+7', '+7'],
    ['+', ''],
    ['8', '+7'],
    ['91112345678999', '+7 911 123-45-67'],
  ])('%s → %s', (input, expected) => {
    expect(formatPhoneInput(input)).toBe(expected)
  })

  it('результат остаётся допустимым номером и не меняется при повторном разборе', () => {
    const typed = formatPhoneInput('9111234567')
    expect(normalizePhone(typed)).toBe('+79111234567')
    expect(formatPhoneInput(typed)).toBe(typed)
  })

  it('стирание с конца идёт по одному символу', () => {
    expect(formatPhoneInput('+7 911 123-45-6')).toBe('+7 911 123-45-6')
    expect(formatPhoneInput('+7 911 123-45-')).toBe('+7 911 123-45')
    expect(formatPhoneInput('+7 911 ')).toBe('+7 911')
  })
})
