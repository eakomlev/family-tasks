import { api } from './api'

export interface ServiceStats {
  accounts: { total: number; today: number }
  families: { total: number; today: number }
  messages: { total: number; today: number }
}

// Состояние очереди отправки писем и push (сутки по UTC, как у дневного бюджета почты).
export interface QueueStats {
  // включена ли очередь на сервере (QUEUE_ENABLED); иначе письма и push отправляет сам server
  enabled: boolean
  notifier: { alive: boolean; instances: number; lastBeatSeconds: number | null }
  // ещё не бравшиеся в работу
  waiting: { email: number; push: number }
  // пробовались и ждут повтора
  retrying: number
  // возраст самой старой строки очереди, секунды (null: очередь пуста)
  oldestSeconds: number | null
  // limit 0: без дневного лимита
  mail: { usedToday: number; limit: number }
  today: { email: { sent: number; failed: number }; push: { sent: number; failed: number } }
}

// Статистика сервиса для администратора. Аргумент: начало сегодняшнего дня в ISO (часовой пояс знает только клиент).
export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    getServiceStats: build.query<ServiceStats, string>({
      query: (since) => ({ path: `/admin/stats?since=${encodeURIComponent(since)}` }),
    }),
    getQueueStats: build.query<QueueStats, void>({
      query: () => ({ path: '/admin/queue' }),
    }),
  }),
})

export const { useGetServiceStatsQuery, useGetQueueStatsQuery } = adminApi
