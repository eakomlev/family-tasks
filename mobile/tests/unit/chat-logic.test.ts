import { describe, expect, it } from 'vitest'
import type { ChatMessage, ChatSummary, Member } from '@/api'
import { eventChatId, isEventChat } from '@/api'
import { memberLabel } from '@/lib/roles'
import { chatPreview, chatPreviewParts, chatTitle, formatChatTime, lastMessageStatus } from '@/features/chat/listUtils'
import { appendMessage, canSend, dayLabel, groupByDay, mergeLatest, messageStatus, participantsLabel, visitLabel } from '@/features/chat/roomUtils'

const msg = (id: string, createdAt = '2026-10-11T10:00:00Z', senderId = 'm1', text = id): ChatMessage => ({ id, senderId, text, caption: text, media: [], createdAt, reactions: [], awards: [] })

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

describe('адрес чата события', () => {
  it('собирается из id события и узнаётся', () => {
    expect(eventChatId('abc')).toBe('event-abc')
    expect(isEventChat('event-abc')).toBe(true)
    expect(isEventChat('family')).toBe(false)
    expect(isEventChat('0f3c1e52-0000-4000-8000-000000000000')).toBe(false)
  })
})

describe('список чатов', () => {
  const members: Member[] = [
    { id: 'me', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
    { id: 'papa', name: 'Игорь', role: 'papa', avatar: null, isOwner: false },
    { id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false },
    { id: 'm3', name: 'Аня', role: 'child', avatar: null, isOwner: false },
  ]
  const chat = (id: string, last: ChatMessage | null): ChatSummary => ({ id, last, unread: 0 })

  it('memberLabel: ребёнок видит родителей как «Мама» и «Папа», остальных и родители по именам', () => {
    expect(memberLabel(members[0], 'child')).toBe('Мама')
    expect(memberLabel(members[1], 'child')).toBe('Папа')
    expect(memberLabel(members[2], 'child')).toBe('Миша')
    expect(memberLabel(members[0], 'papa')).toBe('Лена')
    expect(memberLabel(members[2], 'mama')).toBe('Миша')
  })

  it('lastMessageStatus: статус только у моего последнего сообщения', () => {
    const mine = msg('x', '2026-10-11T10:00:00Z', 'me')
    const theirs = msg('y', '2026-10-11T10:00:00Z', 'm2')
    const withRead = (last: ChatMessage | null, readUpTo?: string | null): ChatSummary => ({ id: 'm2', last, unread: 0, readUpTo })
    expect(lastMessageStatus(withRead(mine, null), 'me')).toBe('sent')
    expect(lastMessageStatus(withRead(mine, '2026-10-11T09:59:59Z'), 'me')).toBe('sent')
    expect(lastMessageStatus(withRead(mine, '2026-10-11T10:00:00Z'), 'me')).toBe('read')
    // чужое сообщение, пустой чат и ответ прежнего сервера без readUpTo: статуса нет
    expect(lastMessageStatus(withRead(theirs, '2026-10-11T11:00:00Z'), 'me')).toBeNull()
    expect(lastMessageStatus(withRead(null, null), 'me')).toBeNull()
    expect(lastMessageStatus(withRead(mine), 'me')).toBeNull()
  })

  it('chatTitle', () => {
    expect(chatTitle('family', members, 'mama')).toBe('Общий чат')
    expect(chatTitle('m2', members, 'mama')).toBe('Миша')
    expect(chatTitle('неизвестно', members, 'mama')).toBe('Чат')
  })

  it('chatTitle для ребёнка: родители «Мама» и «Папа»', () => {
    expect(chatTitle('me', members, 'child')).toBe('Мама')
    expect(chatTitle('papa', members, 'child')).toBe('Папа')
    expect(chatTitle('m3', members, 'child')).toBe('Аня')
  })

  it('chatPreview: без сообщений, своё, чужое в личном и в общем чате; переносы строк сжимаются', () => {
    expect(chatPreview(chat('m2', null), 'me', members, 'mama')).toBe('Сообщений пока нет')
    expect(chatPreview(chat('m2', msg('x', undefined, 'me', 'привет')), 'me', members, 'mama')).toBe('Вы: привет')
    expect(chatPreview(chat('m2', msg('x', undefined, 'm2', 'как\nдела')), 'me', members, 'mama')).toBe('как дела')
    expect(chatPreview(chat('family', msg('x', undefined, 'm2', 'ужин')), 'me', members, 'mama')).toBe('Миша: ужин')
    expect(chatPreview(chat('family', msg('x', undefined, 'me', 'ужин')), 'me', members, 'mama')).toBe('Вы: ужин')
  })

  it('чат события: название события и подпись автора в превью', () => {
    const event = { id: 'e1', title: 'Театр' }
    expect(chatTitle('event-e1', members, 'mama', event.title)).toBe('Театр')
    expect(chatTitle('event-e1', members, 'mama')).toBe('Чат')
    expect(chatPreviewParts({ ...chat('event-e1', msg('x', undefined, 'm2', 'билеты')), event }, 'me', members, 'mama')).toEqual({ prefix: 'Миша:', mine: false, text: 'билеты' })
    expect(chatPreviewParts({ ...chat('event-e1', msg('x', undefined, 'me', 'ок')), event }, 'me', members, 'mama')).toEqual({ prefix: 'Вы:', mine: true, text: 'ок' })
  })

  it('chatPreviewParts: подпись и текст отдельно (подпись выделяется цветом)', () => {
    expect(chatPreviewParts(chat('m2', msg('x', undefined, 'me', 'привет')), 'me', members, 'mama')).toEqual({ prefix: 'Вы:', mine: true, text: 'привет' })
    expect(chatPreviewParts(chat('family', msg('x', undefined, 'm2', 'ужин')), 'me', members, 'mama')).toEqual({ prefix: 'Миша:', mine: false, text: 'ужин' })
    expect(chatPreviewParts(chat('m2', msg('x', undefined, 'm2', 'как\nдела')), 'me', members, 'mama')).toEqual({ mine: false, text: 'как дела' })
    expect(chatPreviewParts(chat('m2', null), 'me', members, 'mama')).toEqual({ mine: false, text: 'Сообщений пока нет' })
  })

  it('chatPreview для ребёнка: в общем чате родитель подписан как «Мама»', () => {
    expect(chatPreview(chat('family', msg('x', undefined, 'me', 'ужин')), 'm2', members, 'child')).toBe('Мама: ужин')
    expect(chatPreview(chat('family', msg('x', undefined, 'm3', 'ужин')), 'm2', members, 'child')).toBe('Аня: ужин')
  })

  it('formatChatTime: сегодня время, вчера «Вчера», раньше дата', () => {
    const now = new Date('2026-10-12T09:00:00Z')
    expect(formatChatTime('2026-10-12T07:05:00Z', now)).toBe('10:05')
    expect(formatChatTime('2026-10-11T07:05:00Z', now)).toBe('Вчера')
    expect(formatChatTime('2026-10-01T07:05:00Z', now)).toMatch(/1\s+окт/)
  })
})

describe('visitLabel', () => {
  const now = new Date('2026-10-12T12:00:00')

  it('общий чат: подписи нет', () => {
    expect(visitLabel(null, now)).toBeNull()
  })

  it('собеседник сейчас в чате', () => {
    expect(visitLabel({ viewing: true, lastVisitAt: '2026-10-10T10:00:00' }, now)).toBe('Сейчас в чате')
  })

  it('визитов не было: подписи нет', () => {
    expect(visitLabel({ viewing: false, lastVisitAt: null }, now)).toBeNull()
  })

  it('сегодня, вчера и раньше', () => {
    expect(visitLabel({ viewing: false, lastVisitAt: '2026-10-12T09:05:00' }, now)).toBe('Последний визит: сегодня в 09:05')
    expect(visitLabel({ viewing: false, lastVisitAt: '2026-10-11T18:30:00' }, now)).toBe('Последний визит: вчера в 18:30')
    expect(visitLabel({ viewing: false, lastVisitAt: '2026-10-05T07:00:00' }, now)).toBe('Последний визит: 5 октября в 07:00')
  })
})

describe('participantsLabel: число участников под заголовком общего чата', () => {
  it('склонение: 1 участник, 2-4 участника, 5 и 11-14 участников; пусто, пока состав не загружен', () => {
    expect(participantsLabel(0)).toBeNull()
    expect(participantsLabel(1)).toBe('1 участник')
    expect(participantsLabel(2)).toBe('2 участника')
    expect(participantsLabel(4)).toBe('4 участника')
    expect(participantsLabel(5)).toBe('5 участников')
    expect(participantsLabel(11)).toBe('11 участников')
    expect(participantsLabel(21)).toBe('21 участник')
    expect(participantsLabel(112)).toBe('112 участников')
  })
})
