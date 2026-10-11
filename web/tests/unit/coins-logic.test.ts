import { describe, expect, it } from 'vitest'
import type { CoinEntry, Member } from '@/api'
import { authorOf, entryMeta, formatAmount, mergeNewest } from '@/pages/Coins/utils'

const entry = (id: string, over: Partial<CoinEntry> = {}): CoinEntry => ({
  id,
  amount: 10,
  reason: id,
  createdAt: '2026-10-11T10:00:00Z',
  createdBy: null,
  ...over,
})

describe('mergeNewest', () => {
  it('новые записи встают сверху, подгруженные ранее старые остаются, hasMore прежний', () => {
    const current = [entry('c'), entry('d'), entry('e')]
    const first = [entry('a'), entry('b'), entry('c')]
    const result = mergeNewest(current, first, true, false)
    expect(result.items.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(result.hasMore).toBe(false)
  })

  it('ничего нового: список не меняется', () => {
    const current = [entry('a'), entry('b')]
    expect(mergeNewest(current, [entry('a'), entry('b')], false, false).items.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('первая загрузка: берётся первая страница и её hasMore', () => {
    expect(mergeNewest([], [entry('a')], true, false)).toEqual({ items: [entry('a')], hasMore: true })
  })

  it('общих записей нет (пропуск между страницами): остаётся только свежая страница', () => {
    const result = mergeNewest([entry('x'), entry('y')], [entry('a'), entry('b')], true, false)
    expect(result.items.map((e) => e.id)).toEqual(['a', 'b'])
    expect(result.hasMore).toBe(true)
  })

  it('пустая свежая страница', () => {
    expect(mergeNewest([entry('x')], [], false, false)).toEqual({ items: [], hasMore: false })
  })
})

describe('formatAmount', () => {
  it('со знаком: плюс у начисления и настоящий минус у списания', () => {
    expect(formatAmount(50)).toBe('+50')
    expect(formatAmount(-20)).toBe('−20')
    expect(formatAmount(1200)).toMatch(/^\+1\s?200$/)
  })
})

describe('кто сделал запись', () => {
  const members: Member[] = [
    { id: 'mama', name: 'Лена', role: 'mama', avatar: null, isOwner: true },
    { id: 'papa', name: 'Игорь', role: 'papa', avatar: null, isOwner: false },
    { id: 'kid', name: 'Миша', role: 'child', avatar: null, isOwner: false },
  ]

  it('ребёнок видит родителей как «Мама» и «Папа», запись без автора это «Система»', () => {
    expect(authorOf(entry('1', { createdBy: 'mama' }), members, 'child')).toBe('Мама')
    expect(authorOf(entry('2', { createdBy: 'papa' }), members, 'child')).toBe('Папа')
    expect(authorOf(entry('3', { createdBy: null }), members, 'child')).toBe('Система')
  })

  it('неизвестный автор не ломает страницу', () => {
    expect(authorOf(entry('4', { createdBy: 'ушёл' }), members, 'child')).toBe('Участник семьи')
  })

  it('подпись «когда · кто»', () => {
    // 2026-10-11 10:00 UTC, часовой пояс тестов Москва
    expect(entryMeta(entry('5', { createdBy: 'mama' }), members, 'child')).toBe('11 октября, 13:00 · Мама')
  })
})
