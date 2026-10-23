import { describe, expect, it } from 'vitest'
import { ApiError } from '../../src/api'
import { describeGameError } from '../../src/lib/errors'

describe('describeGameError', () => {
  it('понятные тексты для известных кодов', () => {
    expect(describeGameError(new ApiError(409, 'not_your_turn'))).toBe('Сейчас ход соперника.')
    expect(describeGameError(new ApiError(400, 'illegal_move'))).toBe('Так ходить нельзя.')
    expect(describeGameError(new ApiError(409, 'game_exists'))).toContain('уже идёт')
  })

  it('неизвестная ошибка — общий текст', () => {
    expect(describeGameError(new Error('x'))).toBe('Не удалось выполнить действие. Попробуйте ещё раз.')
  })
})
