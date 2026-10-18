import { getCoinBalance, getCoinsEarned, listCoinHistory, type CoinHistoryPage } from '@/api'
import { api, fromApi } from './api'

// Монеты ребёнка: «заработано сегодня» (аргумент — начало местного дня) и баланс для родителя на странице ребёнка.
// Начисления, награды и покупки целей сбрасывают теги `Coins` и `Earned` (мутации и сигнал `members`).
export const coinsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCoinsEarned: build.query<{ earned: number }, string>({
      queryFn: fromApi((token, since: string) => getCoinsEarned(token, since)),
      providesTags: ['Earned'],
    }),
    // Первая (свежая) страница истории: записи сверху и баланс. Более старые страницы экран подгружает сам по мере прокрутки.
    // Аргумент — чьи монеты (родителю нужен id ребёнка, ребёнку пусто).
    getCoinHistory: build.query<CoinHistoryPage, string>({
      queryFn: fromApi((token, memberId: string) => listCoinHistory(token, undefined, memberId || undefined)),
      providesTags: ['Coins'],
    }),
    getCoinBalance: build.query<number, string>({
      queryFn: fromApi((token, memberId: string) => getCoinBalance(token, memberId)),
      providesTags: (_result, _error, memberId) => [{ type: 'Coins', id: memberId }],
    }),
  }),
})

export const { useGetCoinsEarnedQuery, useGetCoinHistoryQuery, useGetCoinBalanceQuery } = coinsApi
