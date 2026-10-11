import { describe, expect, it } from 'vitest'
import { completedMessage, createdMessage, dueText, updatedMessage, type TaskDto } from '../../src/tasks/text.js'

const task = (over: Partial<TaskDto> = {}): TaskDto => ({
  id: 't1',
  title: 'Вынести мусор',
  description: '',
  createdAt: '2026-10-11T10:00:00.000Z',
  authorId: 'a',
  assigneeId: 'b',
  date: '2026-10-12',
  time: '18:00',
  repeat: { type: 'none', days: [], until: null },
  ...over,
})

describe('dueText', () => {
  it('дата и время', () => expect(dueText(task())).toBe('12 октября в 18:00'))
  it('только дата', () => expect(dueText(task({ time: null }))).toBe('12 октября'))
  it('без срока пусто', () => expect(dueText(task({ date: null, time: null }))).toBe(''))
  it('повторы', () => {
    expect(dueText(task({ repeat: { type: 'daily', days: [], until: null } }))).toBe('12 октября в 18:00 · каждый день')
    expect(dueText(task({ time: null, repeat: { type: 'weekly', days: [1, 3, 7], until: null } }))).toBe('12 октября · по пн, ср, вс')
    expect(dueText(task({ repeat: { type: 'monthly', days: [], until: null } }))).toContain('раз в месяц')
  })
})

describe('тексты уведомлений', () => {
  it('новое задание', () => {
    expect(createdMessage(task(), 'Лена')).toMatchObject({
      title: 'Новое задание',
      body: 'Лена: Вынести мусор · 12 октября в 18:00',
      url: '/tasks/t1',
    })
  })

  it('изменённое задание', () => {
    expect(updatedMessage(task({ date: null, time: null }), 'Лена')).toMatchObject({ title: 'Задание изменено', body: 'Лена: Вынести мусор' })
  })

  it('выполненное задание называет того, кто выполнил', () => {
    expect(completedMessage(task(), 'Миша')).toMatchObject({ title: 'Задание выполнено', body: 'Миша: Вынести мусор' })
  })
})
