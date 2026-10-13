import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/api'
import { buildLessonReport, GRADES } from '@/lib/lessonReport'
import { REACTIONS } from '@/lib/reactions'
import { groupReactions, replaceMessage, totalCoins } from '@/pages/ChatRoom/utils'
import { gradeTone } from '@/pages/LessonReport/utils'

describe('groupReactions', () => {
  it('одинаковые склеиваются с числом, порядок по первому появлению', () => {
    expect(groupReactions([{ emoji: '👍' }, { emoji: '🔥' }, { emoji: '👍' }, { emoji: '👍' }])).toEqual([
      { emoji: '👍', count: 3 },
      { emoji: '🔥', count: 1 },
    ])
  })
  it('пусто', () => {
    expect(groupReactions([])).toEqual([])
  })
})

describe('totalCoins', () => {
  it('сумма начислений', () => {
    expect(totalCoins([{ amount: 10 }, { amount: 5 }, { amount: 7 }])).toBe(22)
    expect(totalCoins([])).toBe(0)
  })
})

describe('replaceMessage', () => {
  const msg = (id: string, text = id): ChatMessage => ({ id, senderId: 's', text, caption: text, media: [], createdAt: '2026-10-11T10:00:00Z', reactions: [], awards: [] })
  it('заменяет только сообщение с тем же id, порядок сохраняется', () => {
    const updated = { ...msg('b', 'b'), reactions: [{ memberId: 'm', emoji: '👍' }] }
    const result = replaceMessage([msg('a'), msg('b'), msg('c')], updated)
    expect(result.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(result[1].reactions).toHaveLength(1)
    expect(result[0].reactions).toEqual([])
  })
  it('неизвестное сообщение список не меняет', () => {
    const list = [msg('a')]
    expect(replaceMessage(list, msg('zzz'))).toEqual(list)
  })
})

describe('buildLessonReport', () => {
  it('оценка и комментарий: две строки', () => {
    expect(buildLessonReport('Математика', 5, 'Сдал контрольную')).toBe('Урок «Математика»: оценка 5\nСдал контрольную')
  })
  it('только оценка', () => {
    expect(buildLessonReport('Русский язык', 4, '')).toBe('Урок «Русский язык»: оценка 4')
  })
  it('только комментарий', () => {
    expect(buildLessonReport('Физика', null, '  Было сложно  ')).toBe('Урок «Физика»\nБыло сложно')
  })
  it('ничего не выбрано: сообщения нет', () => {
    expect(buildLessonReport('Физика', null, '   ')).toBeNull()
  })
  it('пробелы в названии обрезаются', () => {
    expect(buildLessonReport('  Музыка ', 5, '')).toBe('Урок «Музыка»: оценка 5')
  })
})

describe('списки', () => {
  it('оценки от пятёрки к двойке, цвет у каждой свой', () => {
    expect(GRADES).toEqual([5, 4, 3, 2])
    expect(new Set(GRADES.map(gradeTone)).size).toBe(4)
  })
  it('реакции без повторов', () => {
    expect(new Set(REACTIONS).size).toBe(REACTIONS.length)
  })
})
