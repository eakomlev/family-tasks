import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api'
import { extractCode } from '@/features/auth/inviteCode'
import { describeSignupError } from '@/features/auth/signupErrors'

describe('extractCode', () => {
  it('достаёт код из полной ссылки', () => {
    expect(extractCode('https://family.test/join?code=abc123')).toBe('abc123')
    expect(extractCode('  https://family.test/join?code=abc123&email=a%40b.c ')).toBe('abc123')
  })

  it('принимает просто код', () => {
    expect(extractCode(' abc123 ')).toBe('abc123')
  })

  it('раскодирует процентную запись', () => {
    expect(extractCode('https://x/join?code=a%2Fb')).toBe('a/b')
  })

  it('пустой ввод даёт пустой код', () => {
    expect(extractCode('   ')).toBe('')
  })
})

describe('describeSignupError', () => {
  it('занятое имя и email возвращают к первому шагу', () => {
    expect(describeSignupError(new ApiError(409, 'name_taken')).backToDetails).toBe(true)
    expect(describeSignupError(new ApiError(409, 'email_taken')).backToDetails).toBe(true)
  })

  it('неверный код остаётся на шаге кода', () => {
    const result = describeSignupError(new ApiError(400, 'invalid_code'))
    expect(result.backToDetails).toBe(false)
    expect(result.text).toContain('Неверный код')
  })

  it('неизвестная ошибка даёт общий текст', () => {
    expect(describeSignupError(new Error('x')).text).toBe('Не удалось завершить. Попробуйте ещё раз.')
  })
})
