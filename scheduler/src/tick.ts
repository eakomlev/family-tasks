import type pg from 'pg'
import type { Db } from './db.js'
import {
  birthdayMessages,
  eventMessages,
  lessonsMessage,
  taskMessages,
  type EventInfo,
  type LessonInfo,
  type TaskInfo,
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

// События, которые видит участник и которые начинаются в этот день: автор, участник или событие всей семьи.
async function loadEvents(db: Db, memberId: string, familyId: string, day: string): Promise<EventInfo[]> {
  const { rows } = await db.query(
    `select e.id, e.title, to_char(e.start_date, 'YYYY-MM-DD') as "startDate", to_char(e.start_time, 'HH24:MI') as "startTime"
     from events e
     where e.family_id = $2 and e.start_date = $3::date
       and (e.all_family or e.author_id = $1 or exists (select 1 from event_members em where em.event_id = e.id and em.member_id = $1))`,
    [memberId, familyId, day],
  )
  return rows
}

// Невыполненные задания участника, которые бывают в этот день (отметка, в том числе «на проверке», значит «сделано»).
async function loadTasks(db: Db, memberId: string, day: string): Promise<TaskInfo[]> {
  const { rows } = await db.query(
    `select t.id, t.title, to_char(t.due_date, 'YYYY-MM-DD') as date, to_char(t.due_time, 'HH24:MI') as "dueTime",
            t.repeat_type as "repeatType", t.repeat_days as "repeatDays", to_char(t.repeat_until, 'YYYY-MM-DD') as "repeatUntil"
     from tasks t
     where t.assignee_id = $1 and t.due_date is not null and t.due_date <= $2::date
       and not exists (select 1 from task_completions c where c.task_id = t.id and c.occurrence_date = $2::date)`,
    [memberId, day],
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
  const events = new Map<string, EventInfo[]>()
  const tasks = new Map<string, TaskInfo[]>()
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

      // события и задания: загружаем по участнику и дню (подписки одного человека на разных устройствах делят запрос)
      const cacheKey = `${sub.member_id}|${local.date}`
      if (!events.has(cacheKey)) events.set(cacheKey, await loadEvents(pool, sub.member_id, sub.family_id, local.date))
      planned.push(...eventMessages(events.get(cacheKey)!, local))
      if (!tasks.has(cacheKey)) tasks.set(cacheKey, await loadTasks(pool, sub.member_id, local.date))
      planned.push(...taskMessages(tasks.get(cacheKey)!, local))

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
