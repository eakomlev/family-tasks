import { describe, expect, it } from 'vitest'
import type { Occurrence, TaskList } from '@/api'
import { groupChildTasks } from '@/lib/childTasks'
import { task } from '../helpers'

const TODAY = '2026-10-12'

const occurrence = (taskId: string, date: string | null, doneAt?: string): Occurrence => ({
  taskId,
  date,
  done: doneAt ? { memberId: 'c1', at: doneAt } : null,
  pending: null,
})

const list = (items: { id: string; assignee?: string; time?: string | null; date: string | null; doneAt?: string }[]): TaskList => ({
  tasks: items.map((i) => task({ id: i.id, title: i.id, assigneeId: i.assignee ?? 'c1', time: i.time ?? null, date: i.date })),
  occurrences: items.map((i) => occurrence(i.id, i.date, i.doneAt)),
})

const ids = (entries: { task: { id: string } }[] | undefined) => entries?.map((e) => e.task.id)

describe('groupChildTasks', () => {
  it('пока основной список не пришёл, возвращает undefined', () => {
    expect(groupChildTasks(undefined, undefined, 'c1', TODAY)).toBeUndefined()
  })

  it('раскладывает по группам: просроченные, сегодня (со временем и без), без срока', () => {
    const current = list([
      { id: 'late', date: '2026-10-10' },
      { id: 'noTime', date: TODAY },
      { id: 'withTime', date: TODAY, time: '18:00' },
      { id: 'free', date: null },
      { id: 'other', date: TODAY, assignee: 'c2' },
    ])
    const groups = groupChildTasks(current, undefined, 'c1', TODAY)
    expect(ids(groups?.overdue)).toEqual(['late'])
    // со временем раньше, чем без времени
    expect(ids(groups?.today)).toEqual(['withTime', 'noTime'])
    expect(ids(groups?.undated)).toEqual(['free'])
    expect(groups?.finished).toEqual([])
  })

  it('выполненное сегодня без срока и просроченное попадают в finished, выполненное вчера нет', () => {
    const doneToday = '2026-10-12T10:00:00Z'
    const doneYesterday = '2026-10-11T10:00:00Z'
    const recent = list([
      { id: 'freeDone', date: null, doneAt: doneToday },
      { id: 'lateDone', date: '2026-10-09', doneAt: doneToday },
      { id: 'freeOld', date: null, doneAt: doneYesterday },
      { id: 'todayDone', date: TODAY, doneAt: doneToday },
      { id: 'otherChild', date: null, assignee: 'c2', doneAt: doneToday },
    ])
    const groups = groupChildTasks(list([]), recent, 'c1', TODAY)
    expect(ids(groups?.finished)?.sort()).toEqual(['freeDone', 'lateDone'])
  })

  it('не дублирует то, что уже есть в основном списке', () => {
    const doneToday = '2026-10-12T10:00:00Z'
    const current = list([{ id: 'a', date: null, doneAt: doneToday }])
    const groups = groupChildTasks(current, current, 'c1', TODAY)
    expect(groups?.finished).toEqual([])
    expect(ids(groups?.undated)).toEqual(['a'])
  })
})
