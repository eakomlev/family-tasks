import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api'
import { describeCodeError, describeResendError, isTooSoon } from '@/lib/errors'
import { isValidEmail } from '@/lib/validation'
import { isoWeekday, WEEK_DAYS } from '@/lib/weekdays'
import { describeDue, describeRepeat } from '@/lib/taskText'
import { formatTimeRange } from '@/components/LessonViewList/utils'
import { getAvatarColor, getInitial } from '@/components/Avatar/utils'
import { isCompleteCode, sanitizeCode } from '@/components/CodeStep/utils'
import { describeSignupError } from '@/components/RoleForm/utils'
import { extractCode } from '@/pages/Join/components/EnterCode/utils'
import { describeSaveError } from '@/pages/ProfileEdit/components/ProfileForm/utils'
import { describePhotoError } from '@/pages/ProfileEdit/utils'
import { ImageError } from '@/lib/image'
import { inviteLink } from '@/lib/links'

describe('isValidEmail', () => {
  it.each(['a@b.co', ' a@b.co ', 'ivan.petrov+x@mail.example.com'])('принимает %s', (v) => {
    expect(isValidEmail(v)).toBe(true)
  })
  it.each(['', 'abc', 'a@b', '@b.co', 'a b@c.co', 'a@b .co'])('отклоняет «%s»', (v) => {
    expect(isValidEmail(v)).toBe(false)
  })
})

describe('код из письма', () => {
  it('sanitizeCode оставляет только цифры и режет до 6', () => {
    expect(sanitizeCode('12a 34-5678')).toBe('123456')
    expect(sanitizeCode('abc')).toBe('')
  })
  it('isCompleteCode требует ровно 6 цифр', () => {
    expect(isCompleteCode('123456')).toBe(true)
    expect(isCompleteCode('12345')).toBe(false)
    expect(isCompleteCode('1234567')).toBe(false)
    expect(isCompleteCode('12345a')).toBe(false)
  })
})

describe('extractCode', () => {
  it('достаёт код из ссылки', () => {
    expect(extractCode('https://example.com/join?code=abc123')).toBe('abc123')
  })
  it('ссылка без кода даёт пустую строку', () => {
    expect(extractCode('https://example.com/join')).toBe('')
  })
  it('голый код возвращается как есть, пробелы срезаются', () => {
    expect(extractCode('  abc123 ')).toBe('abc123')
  })
})

describe('inviteLink', () => {
  it('строит ссылку на текущем адресе и кодирует код', () => {
    expect(inviteLink('a b&c')).toBe(`${window.location.origin}/join?code=a%20b%26c`)
  })
})

describe('тексты ошибок', () => {
  it('describeCodeError различает «слишком рано» и «нет связи»', () => {
    expect(describeCodeError(new ApiError(429, 'too_soon'))).toMatch(/Подождите минуту/)
    expect(describeCodeError(new ApiError(0, 'network'))).toMatch(/Нет связи/)
    expect(describeCodeError(new Error('x'))).toMatch(/Не удалось отправить код/)
  })
  it('describeCodeError: лимит писем исчерпан', () => {
    expect(describeCodeError(new ApiError(503, 'mail_busy'))).toBe('Сервис отправки писем сейчас перегружен. Попробуйте позже.')
  })
  it('describeResendError: понятные причины как есть, остальное общим текстом', () => {
    expect(describeResendError(new ApiError(503, 'mail_busy'))).toMatch(/перегружен/)
    expect(describeResendError(new ApiError(429, 'too_soon'))).toMatch(/Подождите минуту/)
    expect(describeResendError(new ApiError(0, 'network'))).toMatch(/Нет связи/)
    expect(describeResendError(new ApiError(500, 'internal_error'))).toBe('Не удалось отправить код. Попробуйте позже.')
    expect(describeResendError(new Error('x'))).toBe('Не удалось отправить код. Попробуйте позже.')
  })
  it('isTooSoon', () => {
    expect(isTooSoon(new ApiError(429, 'too_soon'))).toBe(true)
    expect(isTooSoon(new ApiError(400, 'other'))).toBe(false)
    expect(isTooSoon('too_soon')).toBe(false)
  })
  it('describeSignupError возвращает на первый шаг только при ошибках данных', () => {
    expect(describeSignupError(new ApiError(409, 'name_taken')).backToDetails).toBe(true)
    expect(describeSignupError(new ApiError(409, 'email_taken')).backToDetails).toBe(true)
    expect(describeSignupError(new ApiError(400, 'invalid_code')).backToDetails).toBe(false)
    expect(describeSignupError(new ApiError(410, 'invite_expired')).text).toMatch(/приглашения истёк/)
    expect(describeSignupError(new Error('x'))).toEqual({
      text: 'Не удалось завершить. Попробуйте ещё раз.',
      backToDetails: false,
    })
  })
  it('describeSignupError: семья заполнена', () => {
    expect(describeSignupError(new ApiError(409, 'family_full'))).toMatchObject({ backToDetails: false, text: expect.stringMatching(/6 участников/) })
  })
  it('describeSaveError', () => {
    expect(describeSaveError(new ApiError(409, 'name_taken'))).toMatch(/уже есть участник/)
    expect(describeSaveError(new ApiError(400, 'invalid_birth_date'))).toMatch(/дату рождения/)
    expect(describeSaveError(new ApiError(500, 'x'))).toMatch(/Не удалось сохранить/)
  })
  it('describePhotoError', () => {
    expect(describePhotoError(new ImageError('not_image'))).toMatch(/изображением/)
    expect(describePhotoError(new ImageError('too_large'))).toMatch(/слишком большой/)
    expect(describePhotoError(new ImageError('decode_failed'))).toMatch(/прочитать/)
    expect(describePhotoError(new Error('x'))).toMatch(/сохранить фото/)
  })
})

describe('дни недели', () => {
  it('isoWeekday: воскресенье = 7', () => {
    expect(isoWeekday(new Date(2026, 9, 11))).toBe(7)
    expect(isoWeekday(new Date(2026, 9, 12))).toBe(1)
  })
  it('таблица подряд от 1 до 7', () => {
    expect(WEEK_DAYS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('описание задания', () => {
  it('describeRepeat', () => {
    expect(describeRepeat({ type: 'none', days: [], until: null })).toBe('')
    expect(describeRepeat({ type: 'daily', days: [], until: null })).toBe('каждый день')
    expect(describeRepeat({ type: 'monthly', days: [], until: null })).toBe('раз в месяц')
    expect(describeRepeat({ type: 'weekly', days: [1, 3], until: null })).toBe('по пн, ср')
  })
  it('describeDue', () => {
    expect(describeDue(null, '10:00')).toBe('')
    expect(describeDue('2026-10-12', null)).toBe('12 октября')
    expect(describeDue('2026-10-12', '18:00')).toBe('12 октября в 18:00')
  })
})

describe('formatTimeRange', () => {
  it('все варианты', () => {
    expect(formatTimeRange({ startsAt: '08:30', endsAt: '09:15' })).toBe('08:30–09:15')
    expect(formatTimeRange({ startsAt: '08:30', endsAt: null })).toBe('с 08:30')
    expect(formatTimeRange({ startsAt: null, endsAt: '09:15' })).toBe('до 09:15')
    expect(formatTimeRange({ startsAt: null, endsAt: null })).toBe('')
  })
})

describe('Avatar', () => {
  it('getInitial: первая буква заглавная, для пустого имени «?»', () => {
    expect(getInitial(' анна')).toBe('А')
    expect(getInitial('   ')).toBe('?')
  })
  it('цвет стабилен для одной строки и различается у разных', () => {
    expect(getAvatarColor('abc')).toBe(getAvatarColor('abc'))
    expect(getAvatarColor('abc')).not.toBe(getAvatarColor('abd'))
    expect(getAvatarColor('x')).toMatch(/^hsl\(\d+ 55% 42%\)$/)
  })
})

describe('монеты', () => {
  it('coinsWord склоняет «монета»', async () => {
    const { coinsWord, REWARD_CHOICES, MAX_REWARD } = await import('@/lib/coins')
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(coinsWord)).toEqual([
      '1 монета', '2 монеты', '4 монеты', '5 монет', '11 монет', '12 монет', '14 монет', '21 монета', '22 монеты', '25 монет', '101 монета', '111 монет',
    ])
    expect(REWARD_CHOICES[0]).toBe(0)
    expect(MAX_REWARD).toBe(1000)
  })
})
