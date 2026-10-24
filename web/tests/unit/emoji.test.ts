import { describe, expect, it } from 'vitest'
import { deleteBefore, insertAt, pushRecent } from '@/pages/ChatRoom/components/EmojiPanel/emoji'

describe('эмодзи в поле ввода', () => {
  it('вставляет по курсору и заменяет выделенное', () => {
    expect(insertAt('привет мир', { start: 7, end: 7 }, '😀')).toEqual({ text: 'привет 😀мир', cursor: 9 })
    expect(insertAt('abc', { start: 0, end: 3 }, '😀').text).toBe('😀')
  })

  it('стирает целый эмодзи с цветом кожи и склейкой', () => {
    expect(deleteBefore('a👍🏽', { start: 5, end: 5 }).text).toBe('a')
    expect(deleteBefore('a👨‍👩‍👧', { start: 9, end: 9 }).text).toBe('a')
    expect(deleteBefore('ab', { start: 2, end: 2 })).toEqual({ text: 'a', cursor: 1 })
  })

  it('недавние: свежее первым, без повторов', () => {
    expect(pushRecent(['😀', '😂'], '😂')).toEqual(['😂', '😀'])
  })
})
