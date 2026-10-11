import { request } from '../client'
import type { CoinHistoryPage } from './types'

// before — id самой старой из уже загруженных записей (чтобы получить более старые)
export const listCoinHistory = (token: string, before?: string) =>
  request<CoinHistoryPage>(`/coins${before ? `?before=${before}` : ''}`, {}, token)

export type * from './types'
