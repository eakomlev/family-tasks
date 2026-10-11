import { request } from '../client'
import type { CoinHistoryPage } from './types'

// before — id самой старой из уже загруженных записей (чтобы получить более старые).
// memberId — чьи монеты (родителю, ребёнок видит свои без него).
export const listCoinHistory = (token: string, before?: string, memberId?: string) => {
  const params = new URLSearchParams()
  if (before) params.set('before', before)
  if (memberId) params.set('memberId', memberId)
  const query = params.toString()
  return request<CoinHistoryPage>(`/coins${query ? `?${query}` : ''}`, {}, token)
}

// Баланс ребёнка для родителя (одна запись истории вместе с балансом)
export const getCoinBalance = (token: string, memberId: string) =>
  request<CoinHistoryPage>(`/coins?memberId=${memberId}&limit=1`, {}, token).then((page) => page.balance)

// Сколько монет ребёнок заработал с момента since (ISO-время начала дня)
export const getCoinsEarned = (token: string, since: string) =>
  request<{ earned: number }>(`/coins/earned?since=${encodeURIComponent(since)}`, {}, token)

export type * from './types'
