import { describe, expect, it } from 'vitest'
import { coinsWord, completedMessage, createdMessage, dueText, rewardMessage, updatedMessage, type TaskDto } from '../../src/tasks/text.js'

const task = (over: Partial<TaskDto> = {}): TaskDto => ({
  id: 't1',
  title: 'Вынести мусор',
  description: '',
  reward: 0,
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

describe('награда монетами', () => {
  it('coinsWord склоняет «монета»', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(coinsWord)).toEqual([
      '1 монета', '2 монеты', '4 монеты', '5 монет', '11 монет', '12 монет', '14 монет', '21 монета', '22 монеты', '25 монет', '101 монета', '111 монет',
    ])
  })

  it('rewardMessage: сколько и за что, нажатие ведёт к истории монет', () => {
    expect(rewardMessage(task({ title: 'Вынести мусор', reward: 20 }))).toEqual({
      title: 'Награда',
      body: '+20 монет за «Вынести мусор»',
      url: '/coins',
      tag: 'reward-t1',
    })
  })
})
