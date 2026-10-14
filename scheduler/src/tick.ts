import type pg from 'pg'
import type { Db } from './db.js'
import {
  birthdayMessages,
  lessonsMessage,
  type LessonInfo,
  type MemberInfo,
  trainingMessages,
  type PlannedMessage,
  type TrainingInfo,
} from './messages.js'
import * as outbox from './outbox.js'
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

async function loadFamily(db: Db, familyId: string): Promise<MemberInfo[]> {
  const { rows } = await db.query(
    `select id, name, to_char(birth_date, 'YYYY-MM-DD') as "birthDate"
     from members where family_id = $1`,
    [familyId],
  )
  return rows
}

async function loadTrainings(db: Db, memberId: string): Promise<TrainingInfo[]> {
  const { rows } = await db.query(
    `select weekday, title, place, to_char(starts_at, 'HH24:MI') as "startsAt"
     from training_sessions where member_id = $1 and starts_at is not null`,
    [memberId],
  )
  return rows
}

async function loadLessons(db: Db, memberId: string): Promise<LessonInfo[]> {
  const { rows } = await db.query(
    `select weekday, subject, to_char(starts_at, 'HH24:MI') as "startsAt", to_char(ends_at, 'HH24:MI') as "endsAt"
     from schedule_lessons where member_id = $1 order by weekday, position`,
    [memberId],
  )
  return rows
}

// Один проход: смотрит все подписки и ставит в очередь то, что по их местному времени пора отправить.
// now передаётся параметром, чтобы проход можно было проверить на любом времени.
export async function runTick(pool: pg.Pool, now = new Date()): Promise<{ sent: number }> {
  const { rows: subs } = await pool.query<SubscriptionRow>(
    `select s.id, s.time_zone, m.id as member_id, m.role, m.family_id
     from push_subscriptions s join members m on m.id = s.member_id`,
  )

  const families = new Map<string, MemberInfo[]>()
  const schedules = new Map<string, LessonInfo[]>()
  const trainings = new Map<string, TrainingInfo[]>()
  let sent = 0

  // Запись в журнал и постановка в очередь идут в одной транзакции: если очередь недоступна, журнал откатывается,
  // и следующий проход (в пределах окна догона) попробует снова, а не потеряет напоминание за день.
  const tx = await pool.connect()
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
        if (!families.has(sub.family_id)) families.set(sub.family_id, await loadFamily(pool, sub.family_id))
        planned.push(...birthdayMessages(sub.member_id, families.get(sub.family_id)!, local))
      }

      if (sub.role === 'child' && isDue(local, SLOTS.lessons)) {
        if (!schedules.has(sub.member_id)) schedules.set(sub.member_id, await loadLessons(pool, sub.member_id))
        const message = lessonsMessage(schedules.get(sub.member_id)!, local)
        if (message) planned.push(message)
      }

      // напоминания о тренировках не привязаны к окну дня: время зависит от начала самой тренировки
      if (sub.role === 'child') {
        if (!trainings.has(sub.member_id)) trainings.set(sub.member_id, await loadTrainings(pool, sub.member_id))
        planned.push(...trainingMessages(trainings.get(sub.member_id)!, local))
      }

      for (const { kind, message, day } of planned) {
        await tx.query('begin')
        try {
          if (await claim(tx, sub.id, kind, day ?? local.date)) {
            await outbox.enqueuePush(tx, sub.id, message)
            sent++
          }
          await tx.query('commit')
        } catch (err) {
          await tx.query('rollback').catch(() => {})
          throw err
        }
      }
    }
  } finally {
    tx.release()
  }

  // журнал нужен только на ближайшие дни
  // (отсчёт от переданного времени, а не от часов базы: проход можно выполнить на любую дату, и тест не стареет вместе с календарём)
  await pool.query(`delete from notification_log where day < ($1::timestamptz at time zone 'UTC')::date - 7`, [now])
  return { sent }
}

// Любой постоянный номер: по нему экземпляры договариваются, кто ведёт планировщик (advisory lock в БД).
// Совпадает с ключом прежнего планировщика в server (пока он там есть), поэтому два планировщика не делают проход вместе.
export const SCHEDULER_LOCK_KEY = 7_301_001

// Проход, который выполняет только один экземпляр из нескольких: тот, кто взял блокировку.
// Остальные пропускают проход (leader: false), а если лидер упал, блокировка уходит вместе с его соединением.
export async function runTickAsLeader(pool: pg.Pool, now = new Date()): Promise<{ sent: number; leader: boolean }> {
  const client = await pool.connect()
  let locked = false
  let broken = false
  try {
    const { rows } = await client.query<{ locked: boolean }>('select pg_try_advisory_lock($1) as locked', [SCHEDULER_LOCK_KEY])
    locked = rows[0].locked
    if (!locked) return { sent: 0, leader: false }
    return { ...(await runTick(pool, now)), leader: true }
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
