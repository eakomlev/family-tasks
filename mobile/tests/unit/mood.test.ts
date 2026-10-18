import { describe, expect, it } from 'vitest'
import { currentMood, MOODS } from '@/lib/mood'

// 12 октября 2026 года, понедельник, часовой пояс прогона Europe/Moscow
const now = new Date(2026, 9, 12, 15)

describe('currentMood', () => {
  it('сегодняшнее настроение возвращает вариант с эмоцией', () => {
    const mood = currentMood({ value: 4, at: new Date(2026, 9, 12, 8).toISOString() }, now)
    expect(mood?.emoji).toBe('🙂')
  })

  it('выбранное вчера считается сброшенным', () => {
    expect(currentMood({ value: 5, at: new Date(2026, 9, 11, 23).toISOString() }, now)).toBeUndefined()
  })

  it('без настроения и с неизвестным значением ничего нет', () => {
    expect(currentMood(null, now)).toBeUndefined()
    expect(currentMood(undefined, now)).toBeUndefined()
    expect(currentMood({ value: 9, at: now.toISOString() }, now)).toBeUndefined()
  })

  it('варианты идут от радости к грусти', () => {
    expect(MOODS.map((m) => m.value)).toEqual([5, 4, 3, 2, 1])
  })
})
