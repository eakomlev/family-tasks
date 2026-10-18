import { describe, expect, it } from 'vitest'
import { deleteBefore, EMOJI_CATEGORIES, insertAt, pushRecent, RECENT_LIMIT } from '@/features/chat/emoji'

describe('вставка эмодзи', () => {
  it('ставит в место курсора и сдвигает курсор', () => {
    expect(insertAt('Привет!', { start: 6, end: 6 }, '😀')).toEqual({ text: 'Привет😀!', cursor: 8 })
  })
  it('заменяет выделенное', () => {
    expect(insertAt('abc', { start: 0, end: 3 }, '🎉')).toEqual({ text: '🎉', cursor: 2 })
  })
})

describe('удаление перед курсором', () => {
  it('одна буква', () => {
    expect(deleteBefore('abc', { start: 3, end: 3 })).toEqual({ text: 'ab', cursor: 2 })
  })
  it('целый эмодзи из пары кодовых единиц', () => {
    expect(deleteBefore('a😀', { start: 3, end: 3 })).toEqual({ text: 'a', cursor: 1 })
  })
  it('эмодзи с вариантом начертания', () => {
    expect(deleteBefore('a❤️', { start: 3, end: 3 })).toEqual({ text: 'a', cursor: 1 })
  })
  it('эмодзи с цветом кожи', () => {
    expect(deleteBefore('a👍🏽', { start: 5, end: 5 })).toEqual({ text: 'a', cursor: 1 })
  })
  it('склеенная семья целиком', () => {
    expect(deleteBefore('x👨‍👩‍👧', { start: 9, end: 9 })).toEqual({ text: 'x', cursor: 1 })
  })
  it('выделенное удаляется целиком, в начале ничего', () => {
    expect(deleteBefore('abcd', { start: 1, end: 3 })).toEqual({ text: 'ad', cursor: 1 })
    expect(deleteBefore('abc', { start: 0, end: 0 })).toEqual({ text: 'abc', cursor: 0 })
  })
  it('текст после курсора остаётся', () => {
    expect(deleteBefore('ab😀cd', { start: 4, end: 4 })).toEqual({ text: 'abcd', cursor: 2 })
  })
})

describe('недавние', () => {
  it('самое свежее первым, без повторов, не больше предела', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
    const many = Array.from({ length: RECENT_LIMIT + 5 }, (_, i) => String(i))
    expect(pushRecent(many, 'new')).toHaveLength(RECENT_LIMIT)
  })
})

describe('наборы', () => {
  it('в каждой категории есть эмодзи и нет повторов', () => {
    for (const category of EMOJI_CATEGORIES) {
      expect(category.items.length).toBeGreaterThan(20)
      expect(new Set(category.items).size).toBe(category.items.length)
    }
  })
})
