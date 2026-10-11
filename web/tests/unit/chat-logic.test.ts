import { describe, expect, it } from 'vitest'
import type { ChatMessage, ChatSummary, Member } from '@/api'
import { chatPreview, chatTitle, formatChatTime } from '@/pages/Chat/utils'
import { appendMessage, canSend, dayLabel, groupByDay, mergeLatest, messageStatus } from '@/pages/ChatRoom/utils'

const msg = (id: string, createdAt = '2026-10-11T10:00:00Z', senderId = 'm1', text = id): ChatMessage => ({ id, senderId, text, createdAt })

describe('mergeLatest', () => {
  it('свежая страница пересекается с загруженным: старые подгруженные остаются, hasMore прежний', () => {
    const current = [msg('1'), msg('2'), msg('3'), msg('4')]
    const latest = [msg('3'), msg('4'), msg('5')]
    const result = mergeLatest(current, latest, true, false)
    expect(result.messages.map((m) => m.id)).toEqual(['1', '2', '3', '4', '5'])
    expect(result.hasMore).toBe(false)
  })

  it('первая загрузка: берётся свежая страница и её hasMore', () => {
    const result = mergeLatest([], [msg('9')], true, false)
    expect(result).toEqual({ messages: [msg('9')], hasMore: true })
  })

  it('совпадает только начало: загруженное целиком заменяется свежей страницей', () => {
    const result = mergeLatest([msg('3'), msg('4')], [msg('3'), msg('4'), msg('5')], false, true)
    expect(result.messages.map((m) => m.id)).toEqual(['3', '4', '5'])
    expect(result.hasMore).toBe(false)
  })

  it('общих сообщений нет (пропуск между ними): остаётся только свежая страница', () => {
    const result = mergeLatest([msg('1'), msg('2')], [msg('8'), msg('9')], true, false)
    expect(result.messages.map((m) => m.id)).toEqual(['8', '9'])
    expect(result.hasMore).toBe(true)
  })

  it('пустая свежая страница', () => {
    expect(mergeLatest([msg('1')], [], false, false)).toEqual({ messages: [], hasMore: false })
  })
})

describe('appendMessage', () => {
  it('добавляет новое и не дублирует пришедшее раньше по сокету', () => {
    expect(appendMessage([msg('1')], msg('2')).map((m) => m.id)).toEqual(['1', '2'])
    const list = [msg('1'), msg('2')]
    expect(appendMessage(list, msg('2'))).toBe(list)
  })
})

describe('дни в переписке', () => {
  // 12 октября 2026, полдень по Москве
  const now = new Date('2026-10-12T09:00:00Z')

  it('dayLabel: сегодня, вчера, дата', () => {
    expect(dayLabel('2026-10-12T07:00:00Z', now)).toBe('Сегодня')
    expect(dayLabel('2026-10-11T07:00:00Z', now)).toBe('Вчера')
    expect(dayLabel('2026-10-05T07:00:00Z', now)).toBe('5 октября')
  })

  it('groupByDay: группы по местным дням, порядок сохраняется', () => {
    const groups = groupByDay(
      [msg('a', '2026-10-11T08:00:00Z'), msg('b', '2026-10-11T20:00:00Z'), msg('c', '2026-10-12T05:00:00Z')],
      now,
    )
    expect(groups.map((g) => [g.label, g.messages.map((m) => m.id)])).toEqual([
      ['Вчера', ['a', 'b']],
      ['Сегодня', ['c']],
    ])
  })

  it('граница дня считается по местному времени: 23:30 и 00:30 по Москве это разные дни', () => {
    const groups = groupByDay([msg('a', '2026-10-11T20:30:00Z'), msg('b', '2026-10-11T21:30:00Z')], now)
    expect(groups).toHaveLength(2)
  })

  it('пусто', () => {
    expect(groupByDay([], now)).toEqual([])
  })
})

describe('messageStatus', () => {
  const sent = msg('1', '2026-10-11T10:00:00Z')

  it('прочитано, если отметка собеседника не раньше сообщения (включая равное время)', () => {
    expect(messageStatus(sent, '2026-10-11T10:00:00Z')).toBe('read')
    expect(messageStatus(sent, '2026-10-11T10:05:00Z')).toBe('read')
  })

  it('отправлено, если собеседник читал раньше или не читал вовсе', () => {
    expect(messageStatus(sent, '2026-10-11T09:59:59Z')).toBe('sent')
    expect(messageStatus(sent, null)).toBe('sent')
  })
})

describe('canSend', () => {
  it('пустое и из одних пробелов нельзя, до 2000 знаков после обрезки можно', () => {
    expect(canSend('')).toBe(false)
    expect(canSend('  \n ')).toBe(false)
    expect(canSend(' привет ')).toBe(true)
    expect(canSend('я'.repeat(2000))).toBe(true)
    expect(canSend('я'.repeat(2001))).toBe(false)
  })
})

describe('список чатов', () => {
  const members: Member[] = [
    { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
    { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
  ]
  const chat = (id: string, last: ChatMessage | null): ChatSummary => ({ id, last, unread: 0 })

  it('chatTitle', () => {
    expect(chatTitle('family', members)).toBe('Общий чат')
    expect(chatTitle('m2', members)).toBe('Миша')
    expect(chatTitle('неизвестно', members)).toBe('Чат')
  })

  it('chatPreview: без сообщений, своё, чужое в личном и в общем чате; переносы строк сжимаются', () => {
    expect(chatPreview(chat('m2', null), 'me', members)).toBe('Сообщений пока нет')
    expect(chatPreview(chat('m2', msg('x', undefined, 'me', 'привет')), 'me', members)).toBe('Вы: привет')
    expect(chatPreview(chat('m2', msg('x', undefined, 'm2', 'как\nдела')), 'me', members)).toBe('как дела')
    expect(chatPreview(chat('family', msg('x', undefined, 'm2', 'ужин')), 'me', members)).toBe('Миша: ужин')
    expect(chatPreview(chat('family', msg('x', undefined, 'me', 'ужин')), 'me', members)).toBe('Вы: ужин')
  })

  it('formatChatTime: сегодня время, вчера «Вчера», раньше дата', () => {
    const now = new Date('2026-10-12T09:00:00Z')
    expect(formatChatTime('2026-10-12T07:05:00Z', now)).toBe('10:05')
    expect(formatChatTime('2026-10-11T07:05:00Z', now)).toBe('Вчера')
    expect(formatChatTime('2026-10-01T07:05:00Z', now)).toMatch(/1\s+окт/)
  })
})
