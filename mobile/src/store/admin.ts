import { api } from './api'

export interface ServiceStats {
  accounts: { total: number; today: number }
  families: { total: number; today: number }
  messages: { total: number; today: number }
}

// Состояние очереди отправки писем и push (сутки по UTC, как у дневного бюджета почты).
export interface QueueStats {
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
  // планировщик плановых напоминаний; поля нет у сервера старой версии (во время выкладки)
  scheduler?: {
    alive: boolean
    instances: number
    lastBeatSeconds: number | null
    // секунд с последнего прохода (null: проходов ещё не было)
    lastTickSeconds: number | null
    lastSent: number | null
    // ошибка последнего прохода (null: прошёл без ошибки)
    lastError: string | null
  }
  // сервис живых обновлений; поля нет у сервера старой версии (во время выкладки)
  realtime?: { alive: boolean; instances: number; connections: number; lastBeatSeconds: number | null }
}

// Фото в чатах: жив ли сервис media и сколько места занято.
export interface MediaStats {
  // настроены ли фото на сервере; если нет, остальное нули
  configured: boolean
  alive: boolean
  photos: number
  bytes: number
  // загружено, но не прикреплено к сообщению (через сутки уборка их удалит)
  unattached: { photos: number; bytes: number }
  quotaBytes: number
  // сколько места занимает самая «тяжёлая» семья
  busiestFamilyBytes: number
}

// SMS: сколько отправлено и потрачено, остаток на счёте у SMS Aero, дневной потолок (сутки по UTC). Вход по телефону.
export interface SmsStats {
  // false, пока notifier ни разу не записал остаток: ключи SMS Aero не заданы
  configured: boolean
  // остаток на счёте, рубли (null: ещё ни одной удачной проверки), давность проверки и ошибка последней проверки
  balance: { amount: number | null; checkedSeconds: number | null; error: string | null }
  today: { sent: number; failed: number; spend: number }
  // за последние 7 суток, включая сегодня
  week: { sent: number; failed: number; spend: number }
  // по дням, свежие первыми (только дни с отправками)
  days: { day: string; sent: number; failed: number; spend: number }[]
  waiting: number
  retrying: number
  // 0: без дневного лимита
  limit: number
  usedToday: number
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
    getMediaStats: build.query<MediaStats, void>({
      query: () => ({ path: '/admin/media' }),
    }),
    getSmsStats: build.query<SmsStats, void>({
      query: () => ({ path: '/admin/sms' }),
    }),
  }),
})

export const { useGetServiceStatsQuery, useGetQueueStatsQuery, useGetMediaStatsQuery, useGetSmsStatsQuery } = adminApi
