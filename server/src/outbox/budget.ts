import type { Db } from './index.js'

// Дневной лимит писем: тот же MAIL_DAILY_LIMIT, что у notifier (по умолчанию 2800 при лимите сервиса 3000), 0 это без лимита.
// Значение по умолчанию продублировано в notifier/src/index.ts.
export function mailDailyLimit(): number {
  const raw = process.env.MAIL_DAILY_LIMIT
  if (raw === undefined || raw === '') return 2800
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : 2800
}

// Исчерпан ли дневной бюджет почты. Учитывается и уже отправленное за сутки по UTC (счётчик notifier),
// и ждущее в очереди: ждущее письмо тоже займёт единицу бюджета, так что очередь длиннее остатка не успеет разойтись.
export async function mailBudgetExhausted(db: Db): Promise<boolean> {
  const limit = mailDailyLimit()
  if (limit <= 0) return false
  const { rows } = await db.query<{ load: string }>(
    `select coalesce((select count from provider_usage where provider = 'mail' and day = (now() at time zone 'UTC')::date), 0)
          + (select count(*) from outbox where channel = 'email') as load`,
  )
  return Number(rows[0].load) >= limit
}
