import type { Db } from './db.js'

// Метка живости экземпляра (раз в несколько секунд).
export async function beat(db: Db, instance: string, now: Date): Promise<void> {
  await db.query(
    `insert into scheduler_state (instance, beat_at) values ($1, $2)
     on conflict (instance) do update set beat_at = excluded.beat_at`,
    [instance, now],
  )
  // следы давно остановленных экземпляров не копим
  await db.query(`delete from scheduler_state where beat_at < $1::timestamptz - interval '1 day'`, [now])
}

// Итог прохода лидера: время, сколько поставлено, ошибка (null, если проход прошёл).
export async function recordTick(db: Db, instance: string, now: Date, sent: number, error: string | null): Promise<void> {
  await db.query(
    `insert into scheduler_state (instance, beat_at, last_tick_at, last_sent, last_error) values ($1, $2, $2, $3, $4)
     on conflict (instance) do update
       set last_tick_at = excluded.last_tick_at, last_sent = excluded.last_sent, last_error = excluded.last_error`,
    [instance, now, sent, error],
  )
}

export async function isAlive(db: Db, instance: string, now: Date, maxAgeSeconds: number): Promise<boolean> {
  const { rowCount } = await db.query(
    `select 1 from scheduler_state where instance = $1 and beat_at > $2::timestamptz - make_interval(secs => $3)`,
    [instance, now, maxAgeSeconds],
  )
  return rowCount === 1
}
