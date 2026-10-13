import { api } from './api'

export interface ServiceStats {
  accounts: { total: number; today: number }
  families: { total: number; today: number }
  messages: { total: number; today: number }
}

// Статистика сервиса для администратора. Аргумент: начало сегодняшнего дня в ISO (часовой пояс знает только клиент).
export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    getServiceStats: build.query<ServiceStats, string>({
      query: (since) => ({ path: `/admin/stats?since=${encodeURIComponent(since)}` }),
    }),
  }),
})

export const { useGetServiceStatsQuery } = adminApi
