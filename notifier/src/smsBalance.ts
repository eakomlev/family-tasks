import type { Db } from './db.js'
import type { Log } from './log.js'
import type { Fetcher, SmsAeroConfig } from './providers/sms.js'

// Остаток на счёте SMS Aero: когда деньги кончаются, коды входа молча перестают уходить, поэтому остаток виден на странице «Сервис»
// (с предупреждением). Спрашивает notifier (ключи только у него), server читает таблицу provider_balance.
export const BALANCE_PROVIDER = 'smsaero'
// как часто спрашивать: запрос бесплатный, но частить незачем
export const BALANCE_CHECK_MS = 5 * 60_000

export interface BalanceResult {
  ok: boolean
  balance?: number
  error?: string
}

// GET /v2/balance: {"success":true,"data":{"balance":530.22}}
export async function fetchSmsBalance(config: SmsAeroConfig, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<BalanceResult> {
  const base = config.baseUrl ?? 'https://gate.smsaero.ru/v2'
  const auth = `Basic ${Buffer.from(`${config.email}:${config.apiKey}`).toString('base64')}`
  try {
    const res = await fetcher(`${base}/balance`, { method: 'GET', headers: { authorization: auth }, signal: AbortSignal.timeout(15_000) })
    const text = await res.text()
    let body: { success?: boolean; data?: { balance?: number | string }; message?: string | null } = {}
    try {
      body = JSON.parse(text) as typeof body
    } catch {
      // не JSON: ответ прокси или сбой шлюза
    }
    const balance = Number(body.data?.balance)
    if (res.status >= 200 && res.status < 300 && body.success === true && Number.isFinite(balance)) return { ok: true, balance }
    return { ok: false, error: `balance ${res.status} ${body.message ?? text.slice(0, 120)}`.trim() }
  } catch (err) {
    return { ok: false, error: `balance network: ${(err as Error).message}` }
  }
}

// Спрашивает остаток и записывает. При ошибке прошлый остаток и время проверки остаются, меняется только текст ошибки:
// так на странице видно и последнее известное значение, и то, что свежей проверки нет.
export async function refreshSmsBalance(db: Db, config: SmsAeroConfig, fetcher?: Fetcher, log?: Log): Promise<BalanceResult> {
  const result = await fetchSmsBalance(config, fetcher)
  if (result.ok) {
    await db.query(
      `insert into provider_balance (provider, balance, checked_at, error) values ($1, $2, now(), null)
       on conflict (provider) do update set balance = excluded.balance, checked_at = now(), error = null`,
      [BALANCE_PROVIDER, result.balance],
    )
  } else {
    log?.('warn', 'sms_balance_failed', { error: result.error })
    await db.query(
      `insert into provider_balance (provider, balance, checked_at, error) values ($1, null, now(), $2)
       on conflict (provider) do update set error = excluded.error`,
      [BALANCE_PROVIDER, result.error],
    )
  }
  return result
}
