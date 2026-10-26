import type { Db } from './db.js'
import { MAX_ATTEMPTS } from './retry.js'

export interface Row {
  id: string
  channel: 'email' | 'push' | 'sms'
  priority: number
  payload: unknown
  attempts: number
}

export interface Reaped {
  id: string
  channel: string
  attempts: number
  lastError: string | null
  reason: 'expired' | 'exhausted'
}

// Забирает до limit строк, которым пора. Аренда: next_attempt_at сдвигается вперёд на leaseSeconds, attempts растёт.
// Если notifier упадёт, по истечении аренды строку заберут снова, но попытка уже посчитана.
// skip locked: несколько notifier не берут одну и ту же строку. Время now передаётся параметром (проверка на любом «сейчас»).
export async function claim(db: Db, now: Date, limit: number, leaseSeconds: number): Promise<Row[]> {
  const { rows } = await db.query<Row>(
    `update outbox
        set next_attempt_at = $1::timestamptz + make_interval(secs => $3), attempts = attempts + 1
      where id in (
        select id from outbox
         where next_attempt_at <= $1 and expires_at > $1 and attempts < $4
         order by priority, id
         limit $2
         for update skip locked)
      returning id, channel, priority, payload, attempts`,
    [now, limit, leaseSeconds, MAX_ATTEMPTS],
  )
  return rows.sort((a, b) => a.priority - b.priority || Number(a.id) - Number(b.id))
}

// Результат известен: строка больше не нужна.
export async function complete(db: Db, id: string): Promise<void> {
  await db.query('delete from outbox where id = $1', [id])
}

// Временная ошибка: следующая попытка позже.
export async function reschedule(db: Db, id: string, now: Date, delaySeconds: number, error: string): Promise<void> {
  await db.query(
    `update outbox set next_attempt_at = $2::timestamptz + make_interval(secs => $3), last_error = $4 where id = $1`,
    [id, now, delaySeconds, error],
  )
}

// Строку не поняли (версия новее): возвращаем без траты попытки, пусть её заберёт обновлённый notifier.
export async function defer(db: Db, id: string, now: Date, delaySeconds: number): Promise<void> {
  await db.query(
    `update outbox set next_attempt_at = $2::timestamptz + make_interval(secs => $3), attempts = greatest(attempts - 1, 0)
      where id = $1`,
    [id, now, delaySeconds],
  )
}

// Удаляет то, что отправлять уже нельзя: истёк срок или попытки кончились (в том числе из-за упавшего notifier).
export async function reap(db: Db, now: Date): Promise<Reaped[]> {
  const { rows } = await db.query<{ id: string; channel: string; attempts: number; last_error: string | null; expires_at: Date }>(
    `delete from outbox
      where expires_at <= $1 or (attempts >= $2 and next_attempt_at <= $1)
      returning id, channel, attempts, last_error, expires_at`,
    [now, MAX_ATTEMPTS],
  )
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    attempts: r.attempts,
    lastError: r.last_error,
    reason: r.expires_at <= now ? 'expired' : 'exhausted',
  }))
}

export interface ChannelCounts {
  sent: number
  failed: number
  // расход за проход, рубли (только SMS: цену сообщает провайдер)
  spend: number
}
export type DeliveryCounts = Record<'email' | 'push' | 'sms', ChannelCounts>

// Добавляет итоги прохода в дневные счётчики (сутки по UTC). Нулевые каналы пропускает: пустой проход ничего не пишет.
export async function recordDelivery(db: Db, now: Date, counts: DeliveryCounts): Promise<void> {
  for (const channel of ['email', 'push', 'sms'] as const) {
    const { sent, failed, spend } = counts[channel]
    if (sent === 0 && failed === 0 && spend === 0) continue
    await db.query(
      `insert into delivery_stats (channel, day, sent, failed, spend)
       values ($1, (($2::timestamptz) at time zone 'UTC')::date, $3, $4, $5)
       on conflict (channel, day) do update
         set sent = delivery_stats.sent + excluded.sent, failed = delivery_stats.failed + excluded.failed,
             spend = delivery_stats.spend + excluded.spend`,
      [channel, now, sent, failed, spend],
    )
  }
}

// Старые служебные записи не копим: счётчики отправки и бюджета нужны на ближайшие дни.
export async function housekeeping(db: Db, now: Date): Promise<void> {
  await db.query(`delete from delivery_stats where day < (($1::timestamptz) at time zone 'UTC')::date - 30`, [now])
  await db.query(`delete from provider_usage where day < (($1::timestamptz) at time zone 'UTC')::date - 7`, [now])
}

export async function beat(db: Db, instance: string, now: Date): Promise<void> {
  await db.query(
    `insert into notifier_heartbeat (instance, beat_at) values ($1, $2)
     on conflict (instance) do update set beat_at = excluded.beat_at`,
    [instance, now],
  )
  // следы давно остановленных экземпляров не копим
  await db.query(`delete from notifier_heartbeat where beat_at < $1::timestamptz - interval '1 day'`, [now])
}

export async function isAlive(db: Db, instance: string, now: Date, maxAgeSeconds: number): Promise<boolean> {
  const { rowCount } = await db.query(
    `select 1 from notifier_heartbeat where instance = $1 and beat_at > $2::timestamptz - make_interval(secs => $3)`,
    [instance, now, maxAgeSeconds],
  )
  return rowCount === 1
}
