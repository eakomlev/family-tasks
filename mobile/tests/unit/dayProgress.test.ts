import { describe, expect, it } from 'vitest'
import type { Goal, TaskList } from '@/api'
import { countToday, currentGoal, goalProgress, progressTitle, tasksWord } from '@/features/myDay/dayProgress'
import { occ, task } from '../helpers'

const TODAY = '2026-10-12'

function goal(over: Partial<Goal> = {}): Goal {
  return { id: 'g1', memberId: 'kid', title: 'Лего', price: 300, url: null, image: null, createdAt: '2026-10-01T10:00:00Z', purchasedAt: null, ...over }
}

describe('countToday', () => {
  it('считает только мои сегодняшние; выполненные и отправленные на проверку засчитаны', () => {
    const list: TaskList = {
      tasks: [task({ id: 'a', assigneeId: 'me' }), task({ id: 'b', assigneeId: 'me' }), task({ id: 'c', assigneeId: 'other' })],
      occurrences: [
        occ('a', TODAY, true),
        { ...occ('b', TODAY), pending: { memberId: 'me', at: '2026-10-12T09:00:00Z' } },
        occ('a', '2026-10-11'),
        occ('b', null),
        occ('c', TODAY),
      ],
    }
    expect(countToday(list, 'me', TODAY)).toEqual({ done: 2, total: 2 })
  })
})

describe('progressTitle', () => {
  it('пишет, сколько осталось', () => {
    expect(progressTitle({ done: 1, total: 3 })).toBe('Ещё 2 задания — и день пройден!')
    expect(progressTitle({ done: 0, total: 5 })).toBe('Ещё 5 заданий — и день пройден!')
    expect(progressTitle({ done: 3, total: 3 })).toBe('День пройден! Все задания сделаны')
    expect(progressTitle({ done: 0, total: 0 })).toBe('На сегодня заданий нет')
  })

  it('склоняет «задание»', () => {
    expect([1, 2, 5, 11, 21, 22].map(tasksWord)).toEqual(['1 задание', '2 задания', '5 заданий', '11 заданий', '21 задание', '22 задания'])
  })
})

describe('цель', () => {
  it('берёт первую не купленную', () => {
    expect(currentGoal([goal({ id: 'x', purchasedAt: '2026-10-02T00:00:00Z' }), goal({ id: 'y' })])?.id).toBe('y')
    expect(currentGoal([])).toBeNull()
    expect(currentGoal(undefined)).toBeNull()
  })

  it('доля и подпись пути к цели', () => {
    expect(goalProgress(goal(), 120)).toEqual({ share: 0.4, text: 'До цели «Лего»: 180 монет' })
    expect(goalProgress(goal(), 500)).toEqual({ share: 1, text: 'На цель «Лего» монет хватает!' })
    expect(goalProgress(goal(), -20).share).toBe(0)
  })
})
