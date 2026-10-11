import { request } from '../client'
import type { CoinHistoryPage } from './types'

// before — id самой старой из уже загруженных записей (чтобы получить более старые)
export const listCoinHistory = (token: string, before?: string) =>
  request<CoinHistoryPage>(`/coins${before ? `?before=${before}` : ''}`, {}, token)

// Сколько монет ребёнок заработал с момента since (ISO-время начала дня)
export const getCoinsEarned = (token: string, since: string) =>
  request<{ earned: number }>(`/coins/earned?since=${encodeURIComponent(since)}`, {}, token)

export type * from './types'
