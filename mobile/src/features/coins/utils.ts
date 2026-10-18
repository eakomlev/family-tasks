import type { CoinEntry, Member } from '@/api'
import { formatDateTime } from '@/lib/date'
import { memberLabel, type Role } from '@/lib/roles'

// Сливает свежую первую страницу с уже загруженными записями: новые записи встают сверху, подгруженные ранее старые остаются.
// Нет общих записей (между ними мог появиться пропуск): остаётся только свежая страница.
export function mergeNewest(
  current: CoinEntry[],
  first: CoinEntry[],
  firstHasMore: boolean,
  currentHasMore: boolean,
): { items: CoinEntry[]; hasMore: boolean } {
  const last = first[first.length - 1]
  const idx = last ? current.findIndex((e) => e.id === last.id) : -1
  if (idx >= 0) return { items: [...first, ...current.slice(idx + 1)], hasMore: currentHasMore }
  return { items: first, hasMore: firstHasMore }
}

// «+50» и «−20» (настоящий минус, а не дефис: во всех браузерах одинаково)
export const formatAmount = (amount: number) => `${amount < 0 ? '−' : '+'}${Math.abs(amount).toLocaleString('ru-RU')}`

// Кто сделал запись: ребёнок видит родителей как «Мама» и «Папа», запись без автора это «Система».
export function authorOf(entry: CoinEntry, members: Member[], viewerRole: Role): string {
  if (entry.createdBy === null) return 'Система'
  const member = members.find((m) => m.id === entry.createdBy)
  return member ? memberLabel(member, viewerRole) : 'Участник семьи'
}

// «11 октября, 14:30 · Мама»
export const entryMeta = (entry: CoinEntry, members: Member[], viewerRole: Role) =>
  `${formatDateTime(entry.createdAt)} · ${authorOf(entry, members, viewerRole)}`
