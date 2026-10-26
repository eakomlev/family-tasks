import type { Db } from './db.js'
import type { Log } from './log.js'
import type { Outcome } from './outcome.js'

export type Clock = () => number

// Если ждать дольше, строку не держим в памяти воркера, а откладываем: иначе пауза на час заняла бы место в пачке.
export const MAX_SLEEP_MS = 5000

// Токен-бакет: rate запросов в секунду, всплеск до burst. Резервирует токен сразу и говорит, сколько ждать
// до его использования, поэтому параллельные вызовы получают нарастающие паузы, а не одну и ту же.
export class TokenBucket {
  private tokens: number
  private last: number
  private blockedUntil = 0

  constructor(
    private readonly ratePerSecond: number,
    private readonly burst: number,
    private readonly clock: Clock = Date.now,
  ) {
    this.tokens = burst
    this.last = clock()
  }

  // Берёт токен; возвращает, сколько миллисекунд подождать перед отправкой (0, если можно сразу).
  waitMs(): number {
    const now = this.clock()
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.ratePerSecond)
    this.last = now
    this.tokens -= 1
    const forTokens = this.tokens >= 0 ? 0 : Math.ceil((-this.tokens / this.ratePerSecond) * 1000)
    return Math.max(forTokens, this.blockedUntil - now, 0)
  }

  // Токен не понадобился (строку отложили вместо ожидания).
  refund(): void {
    this.tokens = Math.min(this.burst, this.tokens + 1)
  }

  // Провайдер попросил подождать (Retry-After): до этого момента всем придётся ждать.
  pause(ms: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, this.clock() + ms)
  }
}

// Группа push-сервиса по адресу подписки: у каждого свои ограничения.
export function hostGroup(endpoint: string): string {
  let host: string
  try {
    host = new URL(endpoint).hostname
  } catch {
    return 'other'
  }
  if (host.endsWith('.googleapis.com')) return 'fcm'
  if (host.endsWith('.push.services.mozilla.com')) return 'mozilla'
  if (host.endsWith('.push.apple.com')) return 'apple'
  if (host.endsWith('.notify.windows.com')) return 'windows'
  return 'other'
}

// Скорость отправки push: свой бакет на каждую группу, пауза от одного сервиса не мешает остальным.
export interface PushGate {
  waitMs(endpoint: string): number
  refund(endpoint: string): void
  pause(endpoint: string, seconds: number): void
}

export function createPushGate(ratePerSecond: number, clock: Clock = Date.now): PushGate {
  const buckets = new Map<string, TokenBucket>()
  const bucket = (endpoint: string) => {
    const group = hostGroup(endpoint)
    let b = buckets.get(group)
    if (!b) {
      b = new TokenBucket(ratePerSecond, Math.max(1, ratePerSecond), clock)
      buckets.set(group, b)
    }
    return b
  }
  return {
    waitMs: (endpoint) => bucket(endpoint).waitMs(),
    refund: (endpoint) => bucket(endpoint).refund(),
    pause: (endpoint, seconds) => bucket(endpoint).pause(seconds * 1000),
  }
}

// Дневной бюджет провайдера: счётчик в БД, общий для всех экземпляров notifier. Сутки по UTC.
export interface DailyBudget {
  // Занимает единицу. ok: false, если лимит исчерпан; day нужен, чтобы вернуть единицу в те же сутки.
  reserve(): Promise<{ ok: boolean; used: number; day: string }>
  release(day: string): Promise<void>
}

// limit <= 0: без лимита (например, при разработке с Mailpit).
export function createDailyBudget(db: Db, provider: string, limit: number, clock: Clock = Date.now): DailyBudget {
  return {
    async reserve() {
      const now = new Date(clock())
      if (limit <= 0) {
        const { rows } = await db.query(`select (($1::timestamptz) at time zone 'UTC')::date::text as day`, [now])
        return { ok: true, used: 0, day: rows[0].day }
      }
      // Условие в on conflict делает занятие атомарным: два notifier вместе не превысят лимит.
      const { rows } = await db.query<{ count: number; day: string }>(
        `insert into provider_usage (provider, day, count)
         values ($1, (($2::timestamptz) at time zone 'UTC')::date, 1)
         on conflict (provider, day) do update set count = provider_usage.count + 1
           where provider_usage.count < $3
         returning count, day::text`,
        [provider, now, limit],
      )
      if (rows[0]) return { ok: true, used: rows[0].count, day: rows[0].day }
      const { rows: current } = await db.query<{ count: number; day: string }>(
        `select count, day::text from provider_usage where provider = $1 and day = (($2::timestamptz) at time zone 'UTC')::date`,
        [provider, now],
      )
      return { ok: false, used: current[0]?.count ?? limit, day: current[0]?.day ?? now.toISOString().slice(0, 10) }
    },
    async release(day) {
      if (limit <= 0) return
      await db.query(`update provider_usage set count = greatest(count - 1, 0) where provider = $1 and day = $2::date`, [provider, day])
    },
  }
}

export interface MailLimiterOptions {
  // имя провайдера в журнале: события `<name>_budget_80` и `<name>_budget_exhausted`; по умолчанию mail
  name?: string
  gate: TokenBucket
  budget: DailyBudget
  // 0: без дневного лимита
  limit: number
  log: Log
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Порог предупреждения: доля дневного лимита.
const WARN_SHARE = 0.8
// Через сколько снова предложить письмо, когда бюджет исчерпан (код входа всё равно живёт 10 минут).
const BUDGET_RETRY_SECONDS = 60

// Ограничения для писем: скорость в секунду и дневной бюджет. Не отправленное из-за лимита откладывается без траты попытки.
// Если отправка не удалась, единица бюджета возвращается (письмо провайдер не принял).
export function limitMail<P>(inner: (payload: P) => Promise<Outcome>, options: MailLimiterOptions) {
  const { gate, budget, limit, log, sleep = defaultSleep, name = 'mail' } = options
  const logged = new Set<string>()
  // каждое предупреждение раз в сутки на экземпляр, иначе журнал заполнился бы повторами
  const once = (key: string, fn: () => void) => {
    if (logged.has(key)) return
    logged.add(key)
    fn()
  }

  return async (payload: P): Promise<Outcome> => {
    const wait = gate.waitMs()
    if (wait > MAX_SLEEP_MS) {
      gate.refund()
      return { kind: 'defer', seconds: Math.ceil(wait / 1000), reason: 'rate_limited' }
    }

    const slot = await budget.reserve()
    if (!slot.ok) {
      gate.refund()
      once(`${slot.day}:out`, () => log('error', `${name}_budget_exhausted`, { day: slot.day, used: slot.used, limit }))
      return { kind: 'defer', seconds: BUDGET_RETRY_SECONDS, reason: 'daily_budget' }
    }
    if (limit > 0 && slot.used >= Math.ceil(limit * WARN_SHARE)) {
      once(`${slot.day}:80`, () => log('warn', `${name}_budget_80`, { day: slot.day, used: slot.used, limit }))
    }

    if (wait > 0) await sleep(wait)
    const outcome = await inner(payload)
    if (outcome.kind !== 'sent') await budget.release(slot.day)
    return outcome
  }
}
