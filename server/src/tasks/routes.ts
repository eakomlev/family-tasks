import type { FastifyInstance, FastifyReply } from 'fastify'
import { authenticate } from '../auth.js'
import { pool } from '../db.js'
import { notifyMember } from '../push.js'
import { publish } from '../realtime.js'
import { addDays, isRealDate, NO_DATE, occursOn, occurrencesBetween, type RepeatType, type Schedule } from './recurrence.js'
import { completedMessage, createdMessage, updatedMessage, type TaskDto } from './text.js'

const MAX_RANGE_DAYS = 62
const MIN_DATE = '1900-01-01'
const MAX_DATE = '2100-12-31'

const dateSchema = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const
const timeSchema = { type: ['string', 'null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' } as const
const idParams = { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }

const taskBodySchema = {
  type: 'object',
  required: ['title', 'assigneeId'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    description: { type: 'string', maxLength: 1000 },
    assigneeId: { type: 'string', format: 'uuid' },
    date: dateSchema,
    time: timeSchema,
    repeat: {
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: { enum: ['none', 'daily', 'weekly', 'monthly'] },
        days: { type: 'array', maxItems: 7, items: { type: 'integer', minimum: 1, maximum: 7 } },
        until: dateSchema,
      },
    },
  },
}

const writeSchema = { body: taskBodySchema }
const updateSchema = { params: idParams, body: taskBodySchema }
const idSchema = { params: idParams }
const getSchema = { params: idParams, querystring: { type: 'object', properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } } }
const completionSchema = {
  params: idParams,
  body: { type: 'object', required: ['date'], additionalProperties: false, properties: { date: dateSchema } },
}
const listSchema = {
  querystring: {
    type: 'object',
    required: ['from', 'to'],
    properties: { from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
  },
}
const doneSchema = {
  querystring: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365, default: 30 } } },
}

interface TaskBody {
  title: string
  description?: string
  assigneeId: string
  date?: string | null
  time?: string | null
  repeat?: { type: RepeatType; days?: number[]; until?: string | null }
}

const SELECT_TASK = `
  select t.id, t.title, t.description, t.created_at as "createdAt", t.author_id as "authorId", t.assignee_id as "assigneeId",
         to_char(t.due_date, 'YYYY-MM-DD') as date, to_char(t.due_time, 'HH24:MI') as time,
         t.repeat_type as "repeatType", t.repeat_days as "repeatDays",
         to_char(t.repeat_until, 'YYYY-MM-DD') as "repeatUntil"
  from tasks t`

interface TaskRow {
  id: string
  title: string
  description: string
  createdAt: string
  authorId: string
  assigneeId: string
  date: string | null
  time: string | null
  repeatType: RepeatType
  repeatDays: number[]
  repeatUntil: string | null
}

const toDto = (row: TaskRow): TaskDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  createdAt: row.createdAt,
  authorId: row.authorId,
  assigneeId: row.assigneeId,
  date: row.date,
  time: row.time,
  repeat: { type: row.repeatType, days: row.repeatDays, until: row.repeatUntil },
})

const scheduleOf = (row: TaskRow): Schedule => ({
  date: row.date,
  repeatType: row.repeatType,
  repeatDays: row.repeatDays,
  repeatUntil: row.repeatUntil,
})

type Parsed = { ok: true; value: { schedule: Schedule; time: string | null } } | { ok: false; error: string }

// Проверка сочетаний полей, которые схема запроса выразить не может.
function parseSchedule(body: TaskBody): Parsed {
  const date = body.date ?? null
  const time = body.time ?? null
  const type = body.repeat?.type ?? 'none'
  const until = type === 'none' ? null : (body.repeat?.until ?? null)

  if (date !== null && (!isRealDate(date) || date < MIN_DATE || date > MAX_DATE)) return { ok: false, error: 'invalid_date' }
  if (time !== null && date === null) return { ok: false, error: 'time_requires_date' }
  if (type !== 'none' && date === null) return { ok: false, error: 'repeat_requires_date' }

  let days: number[] = []
  if (type === 'weekly') {
    days = [...new Set(body.repeat?.days ?? [])].sort((a, b) => a - b)
    if (days.length === 0) return { ok: false, error: 'invalid_repeat_days' }
  }
  if (until !== null && (!isRealDate(until) || until > MAX_DATE || (date !== null && until < date))) {
    return { ok: false, error: 'invalid_repeat_until' }
  }
  return { ok: true, value: { schedule: { date, repeatType: type, repeatDays: days, repeatUntil: until }, time } }
}

export async function taskRoutes(app: FastifyInstance) {
  // Авторизация и семья: все запросы только в пределах семьи вошедшего участника.
  async function me(req: Parameters<typeof authenticate>[0], reply: FastifyReply) {
    const member = await authenticate(req)
    if (!member) reply.code(401).send({ error: 'unauthorized' })
    return member
  }

  async function findTask(id: string, familyId: string): Promise<TaskRow | undefined> {
    const { rows } = await pool.query(`${SELECT_TASK} where t.id = $1 and t.family_id = $2`, [id, familyId])
    return rows[0]
  }

  async function assigneeInFamily(assigneeId: string, familyId: string): Promise<boolean> {
    const { rows } = await pool.query('select 1 from members where id = $1 and family_id = $2', [assigneeId, familyId])
    return rows.length > 0
  }

  // Задания на период: вхождения с from по to, а также невыполненные просроченные и задания без срока.
  app.get<{ Querystring: { from: string; to: string } }>('/api/tasks', { schema: listSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const { from, to } = req.query
    if (!isRealDate(from) || !isRealDate(to) || to < from || addDays(from, MAX_RANGE_DAYS) < to) {
      return reply.code(400).send({ error: 'invalid_range' })
    }

    const { rows } = await pool.query<TaskRow>(`${SELECT_TASK} where t.family_id = $1 order by t.created_at`, [member.family_id])
    const { rows: done } = await pool.query(
      `select c.task_id as "taskId", to_char(c.occurrence_date, 'YYYY-MM-DD') as date, c.done_by as "doneBy", c.done_at as "doneAt"
       from task_completions c join tasks t on t.id = c.task_id
       where t.family_id = $1 and (c.occurrence_date between $2 and $3 or t.repeat_type = 'none')`,
      [member.family_id, from, to],
    )
    const doneMap = new Map(done.map((d) => [`${d.taskId}|${d.date}`, d]))

    const tasks: TaskDto[] = []
    const occurrences: { taskId: string; date: string | null; done: { memberId: string; at: string } | null }[] = []
    for (const row of rows) {
      const dates: (string | null)[] =
        row.date === null ? [null] : occurrencesBetween(scheduleOf(row), from, to)
      // просроченное разовое задание остаётся в списке, пока его не выполнят
      if (row.date !== null && row.repeatType === 'none' && row.date < from) dates.push(row.date)

      let included = false
      for (const date of dates) {
        const completion = doneMap.get(`${row.id}|${date ?? NO_DATE}`)
        // выполненное просроченное и выполненное без срока уже не показываем
        if (completion && (date === null || date < from)) continue
        occurrences.push({ taskId: row.id, date, done: completion ? { memberId: completion.doneBy, at: completion.doneAt } : null })
        included = true
      }
      if (included) tasks.push(toDto(row))
    }
    return { tasks, occurrences }
  })

  // Недавно выполненное (для вкладки «Выполненные»), свежее сверху.
  app.get<{ Querystring: { days?: number } }>('/api/tasks/done', { schema: doneSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return

    const { rows } = await pool.query(
      `select t.id, t.title, t.description, t.created_at as "createdAt", t.author_id as "authorId", t.assignee_id as "assigneeId",
              to_char(t.due_date, 'YYYY-MM-DD') as date, to_char(t.due_time, 'HH24:MI') as time,
              t.repeat_type as "repeatType", t.repeat_days as "repeatDays", to_char(t.repeat_until, 'YYYY-MM-DD') as "repeatUntil",
              to_char(c.occurrence_date, 'YYYY-MM-DD') as "occurrenceDate", c.done_by as "doneBy", c.done_at as "doneAt"
       from task_completions c join tasks t on t.id = c.task_id
       where t.family_id = $1 and c.done_at > now() - make_interval(days => $2)
       order by c.done_at desc limit 200`,
      [member.family_id, req.query.days ?? 30],
    )

    const tasks = new Map<string, TaskDto>()
    const occurrences = rows.map((row) => {
      if (!tasks.has(row.id)) tasks.set(row.id, toDto(row))
      return {
        taskId: row.id,
        date: row.occurrenceDate === NO_DATE ? null : (row.occurrenceDate as string),
        done: { memberId: row.doneBy as string, at: row.doneAt as string },
      }
    })
    return { tasks: [...tasks.values()], occurrences }
  })

  // Одно задание и то его вхождение, которое открыто на странице: ?date=YYYY-MM-DD (по умолчанию первое или «без срока»).
  // occurrence = null, если такого вхождения у задания нет.
  app.get<{ Params: { id: string }; Querystring: { date?: string } }>('/api/tasks/:id', { schema: getSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const row = await findTask(req.params.id, member.family_id)
    if (!row) return reply.code(404).send({ error: 'task_not_found' })

    const date = req.query.date ?? row.date
    const valid = date === null ? row.date === null : row.date !== null && isRealDate(date) && occursOn(scheduleOf(row), date)
    let occurrence = null
    if (valid) {
      const { rows } = await pool.query(
        'select done_by as "memberId", done_at as "at" from task_completions where task_id = $1 and occurrence_date = $2',
        [row.id, date ?? NO_DATE],
      )
      occurrence = { taskId: row.id, date, done: rows[0] ? { memberId: rows[0].memberId as string, at: rows[0].at as string } : null }
    }
    return { task: toDto(row), occurrence }
  })

  app.post<{ Body: TaskBody }>('/api/tasks', { schema: writeSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    if (!(await assigneeInFamily(req.body.assigneeId, member.family_id))) {
      return reply.code(400).send({ error: 'assignee_not_found' })
    }
    const parsed = parseSchedule(req.body)
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
    const { schedule, time } = parsed.value

    const { rows } = await pool.query(
      `insert into tasks (family_id, author_id, assignee_id, title, description, due_date, due_time, repeat_type, repeat_days, repeat_until)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [member.family_id, member.id, req.body.assigneeId, req.body.title.trim(), (req.body.description ?? '').trim(), schedule.date, time, schedule.repeatType, schedule.repeatDays, schedule.repeatUntil],
    )
    const task = toDto((await findTask(rows[0].id, member.family_id))!)

    publish(member.family_id, { type: 'tasks' })
    // исполнителю сообщаем о новом задании, если его дал не он сам
    if (task.assigneeId !== member.id) void notifyMember(task.assigneeId, createdMessage(task, member.name))
    return reply.code(201).send({ task })
  })

  // Изменять и удалять может только автор. Если поменялся график, старые отметки о выполнении теряют смысл.
  app.put<{ Params: { id: string }; Body: TaskBody }>('/api/tasks/:id', { schema: updateSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const existing = await findTask(req.params.id, member.family_id)
    if (!existing) return reply.code(404).send({ error: 'task_not_found' })
    if (existing.authorId !== member.id) return reply.code(403).send({ error: 'forbidden' })
    if (!(await assigneeInFamily(req.body.assigneeId, member.family_id))) {
      return reply.code(400).send({ error: 'assignee_not_found' })
    }
    const parsed = parseSchedule(req.body)
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
    const { schedule, time } = parsed.value

    const scheduleChanged = JSON.stringify(scheduleOf(existing)) !== JSON.stringify(schedule)
    const db = await pool.connect()
    try {
      await db.query('begin')
      await db.query(
        `update tasks set assignee_id = $2, title = $3, description = $4, due_date = $5, due_time = $6, repeat_type = $7,
                repeat_days = $8, repeat_until = $9, updated_at = now() where id = $1`,
        [existing.id, req.body.assigneeId, req.body.title.trim(), (req.body.description ?? '').trim(), schedule.date, time, schedule.repeatType, schedule.repeatDays, schedule.repeatUntil],
      )
      if (scheduleChanged) await db.query('delete from task_completions where task_id = $1', [existing.id])
      await db.query('commit')
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }

    const task = toDto((await findTask(existing.id, member.family_id))!)
    publish(member.family_id, { type: 'tasks' })
    if (task.assigneeId !== member.id) void notifyMember(task.assigneeId, updatedMessage(task, member.name))
    return { task }
  })

  app.delete<{ Params: { id: string } }>('/api/tasks/:id', { schema: idSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const existing = await findTask(req.params.id, member.family_id)
    if (!existing) return reply.code(404).send({ error: 'task_not_found' })
    if (existing.authorId !== member.id) return reply.code(403).send({ error: 'forbidden' })
    await pool.query('delete from tasks where id = $1', [existing.id])
    publish(member.family_id, { type: 'tasks' })
    return reply.code(204).send()
  })

  // Отметить выполненным (любой член семьи). date: день вхождения или null для задания без срока.
  app.post<{ Params: { id: string }; Body: { date: string | null } }>(
    '/api/tasks/:id/complete',
    { schema: completionSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const row = await findTask(req.params.id, member.family_id)
      if (!row) return reply.code(404).send({ error: 'task_not_found' })

      const date = req.body.date
      // отметить можно только реальное вхождение задания
      const valid = date === null ? row.date === null : row.date !== null && isRealDate(date) && occursOn(scheduleOf(row), date)
      if (!valid) return reply.code(400).send({ error: 'invalid_occurrence' })

      const { rowCount } = await pool.query(
        `insert into task_completions (task_id, occurrence_date, done_by) values ($1, $2, $3) on conflict do nothing`,
        [row.id, date ?? NO_DATE, member.id],
      )
      publish(member.family_id, { type: 'tasks' })
      // автору сообщаем один раз, при первой отметке и если выполнил не он сам
      if (rowCount === 1 && row.authorId !== member.id) {
        void notifyMember(row.authorId, completedMessage(toDto(row), member.name))
      }
      return reply.code(204).send()
    },
  )

  app.post<{ Params: { id: string }; Body: { date: string | null } }>(
    '/api/tasks/:id/uncomplete',
    { schema: completionSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const row = await findTask(req.params.id, member.family_id)
      if (!row) return reply.code(404).send({ error: 'task_not_found' })
      await pool.query('delete from task_completions where task_id = $1 and occurrence_date = $2', [row.id, req.body.date ?? NO_DATE])
      publish(member.family_id, { type: 'tasks' })
      return reply.code(204).send()
    },
  )
}
