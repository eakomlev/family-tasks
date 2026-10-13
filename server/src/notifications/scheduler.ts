import { pool } from '../db.js'
import { enqueue, PRIORITY, type Db } from '../outbox/index.js'
import { pushEnabled } from '../push.js'
import {
  birthdayMessages,
  lessonsMessage,
  type LessonInfo,
  type MemberInfo,
  trainingMessages,
  type PlannedMessage,
  type TrainingInfo,
} from './messages.js'
import { isDue, localTime, SLOTS, type LocalTime } from './time.js'

interface SubscriptionRow {
  id: string
  time_zone: string
  member_id: string
  role: string
  family_id: string
}

// Пытаемся записать «отправлено» до отправки: если запись уже есть, значит уведомление уходило сегодня.
async function claim(db: Db, subscriptionId: string, kind: string, day: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `insert into notification_log (subscription_id, kind, day) values ($1, $2, $3)
     on conflict do nothing`,
    [subscriptionId, kind, day],
  )
  return rowCount === 1
}

async function loadFamily(familyId: string): Promise<MemberInfo[]> {
  const { rows } = await pool.query(
    `select id, name, to_char(birth_date, 'YYYY-MM-DD') as "birthDate"
     from members where family_id = $1`,
    [familyId],
  )
  return rows
}

async function loadTrainings(memberId: string): Promise<TrainingInfo[]> {
  const { rows } = await pool.query(
    `select weekday, title, place, to_char(starts_at, 'HH24:MI') as "startsAt"
     from training_sessions where member_id = $1 and starts_at is not null`,
    [memberId],
  )
  return rows
}

async function loadLessons(memberId: string): Promise<LessonInfo[]> {
  const { rows } = await pool.query(
    `select weekday, subject, to_char(starts_at, 'HH24:MI') as "startsAt", to_char(ends_at, 'HH24:MI') as "endsAt"
     from schedule_lessons where member_id = $1 order by weekday, position`,
    [memberId],
  )
  return rows
}

// Один проход: смотрит все подписки и отправляет то, что по их местному времени пора отправить.
// now передаётся параметром, чтобы проход можно было проверить на любом времени.
export async function runTick(now = new Date()): Promise<{ sent: number }> {
  if (!pushEnabled) return { sent: 0 }

  const { rows: subs } = await pool.query<SubscriptionRow>(
    `select s.id, s.time_zone, m.id as member_id, m.role, m.family_id
     from push_subscriptions s join members m on m.id = s.member_id`,
  )

  const families = new Map<string, MemberInfo[]>()
  const schedules = new Map<string, LessonInfo[]>()
  const trainings = new Map<string, TrainingInfo[]>()
  let sent = 0

  // С очередью запись в журнал и постановка идут в одной транзакции: если очередь недоступна, журнал откатывается,
  // и следующий проход (в пределах окна догона) попробует снова, а не потеряет напоминание за день.
  // Без очереди (прямая отправка) транзакция запрещена: ответ 410 удаляет подписку другим соединением, а удаление ждёт
  // блокировку, которую держит эта же транзакция (журнал ссылается на подписку), и проход завис бы.
  const transactional = process.env.QUEUE_ENABLED === 'true'
  const tx = transactional ? await pool.connect() : undefined
  try {
    for (const sub of subs) {
      let local: LocalTime
      try {
        local = localTime(now, sub.time_zone)
      } catch {
        continue
      }

      const planned: PlannedMessage[] = []

      if (isDue(local, SLOTS.birthday)) {
        if (!families.has(sub.family_id)) families.set(sub.family_id, await loadFamily(sub.family_id))
        planned.push(...birthdayMessages(sub.member_id, families.get(sub.family_id)!, local))
      }

      if (sub.role === 'child' && isDue(local, SLOTS.lessons)) {
        if (!schedules.has(sub.member_id)) schedules.set(sub.member_id, await loadLessons(sub.member_id))
        const message = lessonsMessage(schedules.get(sub.member_id)!, local)
        if (message) planned.push(message)
      }

      // напоминания о тренировках не привязаны к окну дня: время зависит от начала самой тренировки
      if (sub.role === 'child') {
        if (!trainings.has(sub.member_id)) trainings.set(sub.member_id, await loadTrainings(sub.member_id))
        planned.push(...trainingMessages(trainings.get(sub.member_id)!, local))
      }

      for (const { kind, message, day } of planned) {
        const send = async (db: Db) => {
          if (!(await claim(db, sub.id, kind, day ?? local.date))) return
          const result = await enqueue(db, {
            channel: 'push',
            priority: PRIORITY.planned,
            payload: { v: 1, subscriptionId: sub.id, message },
          })
          if (result === 'sent' || result === 'queued') sent++
        }
        if (!tx) {
          await send(pool)
          continue
        }
        await tx.query('begin')
        try {
          await send(tx)
          await tx.query('commit')
        } catch (err) {
          await tx.query('rollback').catch(() => {})
          throw err
        }
      }
    }
  } finally {
    tx?.release()
  }

  // журнал нужен только на ближайшие дни
  await pool.query(`delete from notification_log where day < current_date - 7`)
  return { sent }
}

// Любой постоянный номер: по нему экземпляры server договариваются, кто ведёт планировщик (advisory lock в БД).
export const SCHEDULER_LOCK_KEY = 7_301_001

// Проход, который выполняет только один экземпляр server из нескольких: тот, кто взял блокировку.
// Остальные пропускают проход (leader: false), а если лидер упал, блокировка уходит вместе с его соединением.
export async function runTickAsLeader(now = new Date()): Promise<{ sent: number; leader: boolean }> {
  const client = await pool.connect()
  let locked = false
  let broken = false
  try {
    const { rows } = await client.query<{ locked: boolean }>('select pg_try_advisory_lock($1) as locked', [SCHEDULER_LOCK_KEY])
    locked = rows[0].locked
    if (!locked) return { sent: 0, leader: false }
    return { ...(await runTick(now)), leader: true }
  } finally {
    if (locked) {
      try {
        await client.query('select pg_advisory_unlock($1)', [SCHEDULER_LOCK_KEY])
      } catch {
        // не удалось снять: закрываем соединение, блокировка уйдёт вместе с ним
        broken = true
      }
    }
    client.release(broken)
  }
}

// Запускает проверку раз в минуту; возвращает функцию остановки.
export function startScheduler(onError: (err: unknown) => void): () => void {
  if (!pushEnabled) return () => {}

  let running = false
  const tick = async () => {
    // если предыдущий проход затянулся, новый пропускаем
    if (running) return
    running = true
    try {
      await runTickAsLeader()
    } catch (err) {
      onError(err)
    } finally {
      running = false
    }
  }

  const timer = setInterval(tick, 60_000)
  const first = setTimeout(tick, 5_000)
  return () => {
    clearInterval(timer)
    clearTimeout(first)
  }
}
