import type { FastifyInstance, FastifyReply } from 'fastify'
import { authenticate } from '../auth.js'
import { pool } from '../db.js'
import { enqueueToMember } from '../outbox/index.js'
import { publish } from '../realtime.js'
import { addDays, isRealDate, NO_DATE, occursOn, occurrencesBetween, previousOccurrence, type RepeatType, type Schedule } from './recurrence.js'
import { completedMessage, createdMessage, reviewMessage, rewardMessage, updatedMessage, type TaskDto } from './text.js'

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
    reward: { type: 'integer', minimum: 0, maximum: 1000 },
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
    properties: {
      from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      // повторяющиеся задания показывать одним вхождением на серию (см. ниже)
      collapse: { type: 'boolean', default: false },
    },
  },
}
const doneSchema = {
  querystring: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365, default: 30 } } },
}

interface TaskBody {
  title: string
  description?: string
  reward?: number
  assigneeId: string
  date?: string | null
  time?: string | null
  repeat?: { type: RepeatType; days?: number[]; until?: string | null }
}

const SELECT_TASK = `
  select t.id, t.title, t.description, t.reward, t.created_at as "createdAt", t.author_id as "authorId", t.assignee_id as "assigneeId",
         to_char(t.due_date, 'YYYY-MM-DD') as date, to_char(t.due_time, 'HH24:MI') as time,
         t.repeat_type as "repeatType", t.repeat_days as "repeatDays",
         to_char(t.repeat_until, 'YYYY-MM-DD') as "repeatUntil"
  from tasks t`

interface TaskRow {
  id: string
  title: string
  description: string
  reward: number
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
  reward: row.reward,
  createdAt: row.createdAt,
  authorId: row.authorId,
  assigneeId: row.assigneeId,
  date: row.date,
  time: row.time,
  repeat: { type: row.repeatType, days: row.repeatDays, until: row.repeatUntil },
})

// Вхождение для клиента: done заполнено у подтверждённого, pending у ожидающего проверки родителем (оба null у невыполненного).
interface OccurrenceDto {
  taskId: string
  date: string | null
  done: { memberId: string; at: string } | null
  pending: { memberId: string; at: string } | null
}

const occurrenceDto = (
  taskId: string,
  date: string | null,
  completion?: { doneBy: string; doneAt: string; pending: boolean },
): OccurrenceDto => ({
  taskId,
  date,
  done: completion && !completion.pending ? { memberId: completion.doneBy, at: completion.doneAt } : null,
  pending: completion?.pending ? { memberId: completion.doneBy, at: completion.doneAt } : null,
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

  // Ребёнок видит только свои задания: назначенные ему и созданные им. Родители видят все задания семьи.
  // Условие для SQL (параметр `param` это id участника) и значения, которые нужно добавить к запросу.
  const visibility = (member: { id: string; role: string }, param: number) =>
    member.role === 'child'
      ? { sql: ` and (t.assignee_id = $${param} or t.author_id = $${param})`, values: [member.id] }
      : { sql: '', values: [] as string[] }

  // Задание, доступное этому участнику; чужое ребёнка не отличается от несуществующего (404).
  async function findTask(id: string, member: { id: string; role: string; family_id: string }): Promise<TaskRow | undefined> {
    const vis = visibility(member, 3)
    const { rows } = await pool.query(`${SELECT_TASK} where t.id = $1 and t.family_id = $2${vis.sql}`, [id, member.family_id, ...vis.values])
    return rows[0]
  }

  // Роль исполнителя, если он есть в семье, иначе undefined.
  async function assigneeRole(assigneeId: string, familyId: string): Promise<string | undefined> {
    const { rows } = await pool.query('select role from members where id = $1 and family_id = $2', [assigneeId, familyId])
    return rows[0]?.role
  }

  // Награда монетами только за задания детей (у родителей монет нет) и только от родителей: ребёнок не может
  // выдать монеты ни себе, ни другим. Возвращает код ошибки или undefined, если всё в порядке.
  const rewardError = (reward: number | undefined, assigneeRole: string, authorRole: string) =>
    !reward ? undefined : authorRole === 'child' ? 'reward_requires_parent' : assigneeRole !== 'child' ? 'reward_requires_child' : undefined

  // Забрать ранее выданные монеты по заданию (отмена отметки, смена графика): по каждому ребёнку и вхождению отменяется
  // всё, что ещё не отменено, поэтому повторные отметки и отмены никогда не дают больше одной награды за выполнение.
  // occurrenceDate null — по всем вхождениям задания. Возвращает число созданных записей.
  async function revokeRewards(db: { query: typeof pool.query }, taskId: string, occurrenceDate: string | null, reason: string, by: string | null): Promise<number> {
    const result = await db.query(
      `insert into coin_transactions (member_id, amount, reason, created_by, task_id, occurrence_date)
       select member_id, -sum(amount), $3, $4, task_id, occurrence_date
       from coin_transactions
       where task_id = $1 and ($2::date is null or occurrence_date = $2)
       group by member_id, task_id, occurrence_date
       having sum(amount) > 0`,
      [taskId, occurrenceDate, reason, by],
    )
    return result.rowCount ?? 0
  }

  // Задания на период: вхождения с from по to, а также невыполненные просроченные и задания без срока.
  // collapse: у повторяющегося задания остаётся одно текущее вхождение (from считается сегодняшним днём):
  //  - есть вхождение на from: оно, выполненное или нет;
  //  - иначе ближайшее будущее, но только если предыдущее вхождение серии не выполнено или его не было:
  //    выполненное предыдущее значит, что следующее появится только в свой день.
  app.get<{ Querystring: { from: string; to: string; collapse?: boolean } }>('/api/tasks', { schema: listSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const { from, to, collapse } = req.query
    if (!isRealDate(from) || !isRealDate(to) || to < from || addDays(from, MAX_RANGE_DAYS) < to) {
      return reply.code(400).send({ error: 'invalid_range' })
    }

    const vis = visibility(member, 2)
    const { rows } = await pool.query<TaskRow>(`${SELECT_TASK} where t.family_id = $1${vis.sql} order by t.created_at`, [member.family_id, ...vis.values])
    const { rows: done } = await pool.query(
      `select c.task_id as "taskId", to_char(c.occurrence_date, 'YYYY-MM-DD') as date, c.done_by as "doneBy", c.done_at as "doneAt", c.pending
       from task_completions c join tasks t on t.id = c.task_id
       where t.family_id = $1 and (c.occurrence_date between $2 and $3 or t.repeat_type = 'none')`,
      [member.family_id, from, to],
    )
    const doneMap = new Map(done.map((d) => [`${d.taskId}|${d.date}`, d]))

    // для схлопывания: какие серии без вхождения на from имеют выполненное предыдущее вхождение
    const prevDone = new Set<string>()
    if (collapse) {
      const pairs = rows
        .filter((r) => r.date !== null && r.repeatType !== 'none')
        .map((r) => [r.id, previousOccurrence(scheduleOf(r), from)] as const)
        .filter((p): p is readonly [string, string] => p[1] !== null)
      if (pairs.length > 0) {
        const { rows: prev } = await pool.query<{ taskId: string }>(
          `select c.task_id as "taskId" from task_completions c
           join unnest($1::uuid[], $2::date[]) as p(task_id, day) on p.task_id = c.task_id and p.day = c.occurrence_date
           where not c.pending`,
          [pairs.map((p) => p[0]), pairs.map((p) => p[1])],
        )
        for (const r of prev) prevDone.add(r.taskId)
      }
    }

    const tasks: TaskDto[] = []
    const occurrences: OccurrenceDto[] = []
    for (const row of rows) {
      const dates: (string | null)[] =
        row.date === null ? [null] : occurrencesBetween(scheduleOf(row), from, to)
      if (collapse && row.date !== null && row.repeatType !== 'none' && dates.length > 0) {
        if (dates[0] === from) dates.splice(1)
        else if (prevDone.has(row.id)) dates.length = 0
        else dates.splice(1)
      }
      // просроченное разовое задание остаётся в списке, пока его не выполнят
      if (row.date !== null && row.repeatType === 'none' && row.date < from) dates.push(row.date)

      let included = false
      for (const date of dates) {
        const completion = doneMap.get(`${row.id}|${date ?? NO_DATE}`)
        // подтверждённое просроченное и подтверждённое без срока уже не показываем; ожидающее проверки показываем всегда
        if (completion && !completion.pending && (date === null || date < from)) continue
        occurrences.push(occurrenceDto(row.id, date, completion))
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
      `select t.id, t.title, t.description, t.reward, t.created_at as "createdAt", t.author_id as "authorId", t.assignee_id as "assigneeId",
              to_char(t.due_date, 'YYYY-MM-DD') as date, to_char(t.due_time, 'HH24:MI') as time,
              t.repeat_type as "repeatType", t.repeat_days as "repeatDays", to_char(t.repeat_until, 'YYYY-MM-DD') as "repeatUntil",
              to_char(c.occurrence_date, 'YYYY-MM-DD') as "occurrenceDate", c.done_by as "doneBy", c.done_at as "doneAt"
       from task_completions c join tasks t on t.id = c.task_id
       where t.family_id = $1 and not c.pending and c.done_at > now() - make_interval(days => $2)${visibility(member, 3).sql}
       order by c.done_at desc limit 200`,
      [member.family_id, req.query.days ?? 30, ...visibility(member, 3).values],
    )

    const tasks = new Map<string, TaskDto>()
    const occurrences = rows.map((row) => {
      if (!tasks.has(row.id)) tasks.set(row.id, toDto(row))
      return {
        taskId: row.id,
        date: row.occurrenceDate === NO_DATE ? null : (row.occurrenceDate as string),
        done: { memberId: row.doneBy as string, at: row.doneAt as string },
        pending: null,
      }
    })
    return { tasks: [...tasks.values()], occurrences }
  })

  // Задания, ожидающие подтверждения родителем: любой день, свежие отправки сверху. Родитель видит все по семье, ребёнок свои.
  app.get('/api/tasks/pending', async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const vis = visibility(member, 2)
    const { rows } = await pool.query(
      `select t.id, t.title, t.description, t.reward, t.created_at as "createdAt", t.author_id as "authorId", t.assignee_id as "assigneeId",
              to_char(t.due_date, 'YYYY-MM-DD') as date, to_char(t.due_time, 'HH24:MI') as time,
              t.repeat_type as "repeatType", t.repeat_days as "repeatDays", to_char(t.repeat_until, 'YYYY-MM-DD') as "repeatUntil",
              to_char(c.occurrence_date, 'YYYY-MM-DD') as "occurrenceDate", c.done_by as "doneBy", c.done_at as "doneAt"
       from task_completions c join tasks t on t.id = c.task_id
       where t.family_id = $1 and c.pending${vis.sql}
       order by c.done_at desc limit 200`,
      [member.family_id, ...vis.values],
    )
    const tasks = new Map<string, TaskDto>()
    const occurrences = rows.map((row) => {
      if (!tasks.has(row.id)) tasks.set(row.id, toDto(row))
      return {
        taskId: row.id,
        date: row.occurrenceDate === NO_DATE ? null : (row.occurrenceDate as string),
        done: null,
        pending: { memberId: row.doneBy as string, at: row.doneAt as string },
      }
    })
    return { tasks: [...tasks.values()], occurrences }
  })

  // Одно задание и то его вхождение, которое открыто на странице: ?date=YYYY-MM-DD (по умолчанию первое или «без срока»).
  // occurrence = null, если такого вхождения у задания нет.
  app.get<{ Params: { id: string }; Querystring: { date?: string } }>('/api/tasks/:id', { schema: getSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const row = await findTask(req.params.id, member)
    if (!row) return reply.code(404).send({ error: 'task_not_found' })

    const date = req.query.date ?? row.date
    const valid = date === null ? row.date === null : row.date !== null && isRealDate(date) && occursOn(scheduleOf(row), date)
    let occurrence = null
    if (valid) {
      const { rows } = await pool.query(
        'select done_by as "doneBy", done_at as "doneAt", pending from task_completions where task_id = $1 and occurrence_date = $2',
        [row.id, date ?? NO_DATE],
      )
      occurrence = occurrenceDto(row.id, date, rows[0])
    }
    return { task: toDto(row), occurrence }
  })

  app.post<{ Body: TaskBody }>('/api/tasks', { schema: writeSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const role = await assigneeRole(req.body.assigneeId, member.family_id)
    if (!role) return reply.code(400).send({ error: 'assignee_not_found' })
    const rewardProblem = rewardError(req.body.reward, role, member.role)
    if (rewardProblem) return reply.code(400).send({ error: rewardProblem })
    const parsed = parseSchedule(req.body)
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
    const { schedule, time } = parsed.value

    const { rows } = await pool.query(
      `insert into tasks (family_id, author_id, assignee_id, title, description, reward, due_date, due_time, repeat_type, repeat_days, repeat_until)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [member.family_id, member.id, req.body.assigneeId, req.body.title.trim(), (req.body.description ?? '').trim(), req.body.reward ?? 0, schedule.date, time, schedule.repeatType, schedule.repeatDays, schedule.repeatUntil],
    )
    const task = toDto((await findTask(rows[0].id, member))!)

    publish(member.family_id, { type: 'tasks' })
    // исполнителю сообщаем о новом задании, если его дал не он сам
    if (task.assigneeId !== member.id) void enqueueToMember(pool, task.assigneeId, createdMessage(task, member.name))
    return reply.code(201).send({ task })
  })

  // Изменять и удалять может только автор. Если поменялся график, старые отметки о выполнении теряют смысл.
  app.put<{ Params: { id: string }; Body: TaskBody }>('/api/tasks/:id', { schema: updateSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const existing = await findTask(req.params.id, member)
    if (!existing) return reply.code(404).send({ error: 'task_not_found' })
    if (existing.authorId !== member.id) return reply.code(403).send({ error: 'forbidden' })
    const role = await assigneeRole(req.body.assigneeId, member.family_id)
    if (!role) return reply.code(400).send({ error: 'assignee_not_found' })
    const rewardProblem = rewardError(req.body.reward, role, member.role)
    if (rewardProblem) return reply.code(400).send({ error: rewardProblem })
    const parsed = parseSchedule(req.body)
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
    const { schedule, time } = parsed.value

    const scheduleChanged = JSON.stringify(scheduleOf(existing)) !== JSON.stringify(schedule)
    let revoked = false
    const db = await pool.connect()
    try {
      await db.query('begin')
      await db.query(
        `update tasks set assignee_id = $2, title = $3, description = $4, reward = $5, due_date = $6, due_time = $7, repeat_type = $8,
                repeat_days = $9, repeat_until = $10, updated_at = now() where id = $1`,
        [existing.id, req.body.assigneeId, req.body.title.trim(), (req.body.description ?? '').trim(), req.body.reward ?? 0, schedule.date, time, schedule.repeatType, schedule.repeatDays, schedule.repeatUntil],
      )
      if (scheduleChanged) {
        // отметки теряют смысл, а вместе с ними и награды за них
        revoked = (await revokeRewards(db, existing.id, null, `Отмена: задание изменено («${existing.title}»)`, null)) > 0
        await db.query('delete from task_completions where task_id = $1', [existing.id])
      }
      await db.query('commit')
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }

    const task = toDto((await findTask(existing.id, member))!)
    publish(member.family_id, { type: 'tasks' })
    // баланс детей изменился
    if (revoked) publish(member.family_id, { type: 'members' })
    if (task.assigneeId !== member.id) void enqueueToMember(pool, task.assigneeId, updatedMessage(task, member.name))
    return { task }
  })

  app.delete<{ Params: { id: string } }>('/api/tasks/:id', { schema: idSchema }, async (req, reply) => {
    const member = await me(req, reply)
    if (!member) return
    const existing = await findTask(req.params.id, member)
    if (!existing) return reply.code(404).send({ error: 'task_not_found' })
    if (existing.authorId !== member.id) return reply.code(403).send({ error: 'forbidden' })
    await pool.query('delete from tasks where id = $1', [existing.id])
    publish(member.family_id, { type: 'tasks' })
    return reply.code(204).send()
  })

  // Родителям семьи (мама, папа): например, что ребёнок отправил задание на проверку.
  async function notifyParents(familyId: string, message: ReturnType<typeof reviewMessage>) {
    const { rows } = await pool.query<{ id: string }>(`select id from members where family_id = $1 and role in ('mama', 'papa')`, [familyId])
    await Promise.all(rows.map((p) => enqueueToMember(pool, p.id, message)))
  }

  // Общая часть отметки и подтверждения. Что происходит:
  //  - вхождения ещё не отмечали, отмечает ребёнок задание с наградой: отправка на проверку (pending), монет пока нет;
  //  - вхождения ещё не отмечали, иначе: выполнено сразу, награда (если есть) выдаётся исполнителю;
  //  - вхождение ждёт проверки, а отмечает родитель: подтверждение, награда выдаётся исполнителю;
  //  - остальное (повторная отметка, ребёнок повторно отправляет): ничего не меняется.
  // Награда и отметка одной транзакцией, награда не выдаётся дважды.
  async function completeOccurrence(
    member: { id: string; name: string; role: string; family_id: string },
    row: TaskRow,
    date: string | null,
    // confirmOnly: только подтвердить то, что ждёт проверки; ничего не создавать
    confirmOnly = false,
  ): Promise<'submitted' | 'done' | 'confirmed' | 'unchanged'> {
    const occurrence = date ?? NO_DATE
    const isChild = member.role === 'child'
    let outcome: 'submitted' | 'done' | 'confirmed' | 'unchanged' = 'unchanged'
    const db = await pool.connect()
    try {
      await db.query('begin')
      const { rows: existing } = await db.query<{ pending: boolean }>(
        'select pending from task_completions where task_id = $1 and occurrence_date = $2 for update',
        [row.id, occurrence],
      )
      const pay = () =>
        db.query(
          `insert into coin_transactions (member_id, amount, reason, created_by, task_id, occurrence_date) values ($1, $2, $3, $4, $5, $6)`,
          [row.assigneeId, row.reward, `Задание: ${row.title}`, row.authorId, row.id, occurrence],
        )
      if (existing.length === 0) {
        if (confirmOnly) {
          await db.query('rollback')
          return 'unchanged'
        }
        const needsReview = row.reward > 0 && isChild
        await db.query(
          `insert into task_completions (task_id, occurrence_date, done_by, pending, confirmed_by, confirmed_at)
           values ($1, $2, $3, $4, $5, case when $4 then null else now() end)`,
          [row.id, occurrence, member.id, needsReview, needsReview ? null : member.id],
        )
        if (needsReview) outcome = 'submitted'
        else {
          outcome = 'done'
          if (row.reward > 0) await pay()
        }
      } else if (existing[0].pending && !isChild) {
        await db.query(
          `update task_completions set pending = false, confirmed_by = $3, confirmed_at = now() where task_id = $1 and occurrence_date = $2`,
          [row.id, occurrence, member.id],
        )
        outcome = 'confirmed'
        if (row.reward > 0) await pay()
      }
      await db.query('commit')
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    } finally {
      db.release()
    }

    publish(member.family_id, { type: 'tasks' })
    const dto = toDto(row)
    if (outcome === 'submitted') {
      // родителям: ребёнок ждёт подтверждения
      void notifyParents(member.family_id, reviewMessage(dto, member.name))
    }
    if ((outcome === 'done' || outcome === 'confirmed') && row.reward > 0) {
      // баланс исполнителя изменился; сообщаем ему, если подтвердил или отметил не он сам
      publish(member.family_id, { type: 'members' })
      if (row.assigneeId !== member.id) void enqueueToMember(pool, row.assigneeId, rewardMessage(dto))
    }
    // автору сообщаем один раз, когда задание выполнено (подтверждено), и если это сделал не он сам
    if ((outcome === 'done' || outcome === 'confirmed') && row.authorId !== member.id) {
      void enqueueToMember(pool, row.authorId, completedMessage(dto, member.name))
    }
    return outcome
  }

  // Проверка вхождения из запроса: должно быть настоящим вхождением задания.
  const validOccurrence = (row: TaskRow, date: string | null) =>
    date === null ? row.date === null : row.date !== null && isRealDate(date) && occursOn(scheduleOf(row), date)

  // Отметить выполненным (любой член семьи). date: день вхождения или null для задания без срока.
  // Задание с наградой ребёнок только отправляет на проверку, подтверждает родитель (этим же запросом или /confirm).
  app.post<{ Params: { id: string }; Body: { date: string | null } }>(
    '/api/tasks/:id/complete',
    { schema: completionSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const row = await findTask(req.params.id, member)
      if (!row) return reply.code(404).send({ error: 'task_not_found' })
      if (!validOccurrence(row, req.body.date)) return reply.code(400).send({ error: 'invalid_occurrence' })
      await completeOccurrence(member, row, req.body.date)
      return reply.code(204).send()
    },
  )

  // Подтвердить отправленное на проверку (только родитель): выдаёт награду. Если проверять нечего, 400 `not_pending`.
  app.post<{ Params: { id: string }; Body: { date: string | null } }>(
    '/api/tasks/:id/confirm',
    { schema: completionSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      if (member.role === 'child') return reply.code(403).send({ error: 'parents_only' })
      const row = await findTask(req.params.id, member)
      if (!row) return reply.code(404).send({ error: 'task_not_found' })
      if (!validOccurrence(row, req.body.date)) return reply.code(400).send({ error: 'invalid_occurrence' })
      const outcome = await completeOccurrence(member, row, req.body.date, true)
      if (outcome !== 'confirmed') return reply.code(400).send({ error: 'not_pending' })
      return reply.code(204).send()
    },
  )

  // Снять отметку (или вернуть отправленное на проверку). Забирает выданную награду, если она была.
  // Ребёнок может снять только то, что ещё не подтверждено: подтверждённое задание с наградой отменяет только родитель.
  app.post<{ Params: { id: string }; Body: { date: string | null } }>(
    '/api/tasks/:id/uncomplete',
    { schema: completionSchema },
    async (req, reply) => {
      const member = await me(req, reply)
      if (!member) return
      const row = await findTask(req.params.id, member)
      if (!row) return reply.code(404).send({ error: 'task_not_found' })
      const occurrence = req.body.date ?? NO_DATE
      let revoked = false
      const db = await pool.connect()
      try {
        await db.query('begin')
        const { rows: existing } = await db.query<{ pending: boolean }>(
          'select pending from task_completions where task_id = $1 and occurrence_date = $2 for update',
          [row.id, occurrence],
        )
        if (existing.length > 0) {
          if (member.role === 'child' && row.reward > 0 && !existing[0].pending) {
            await db.query('rollback')
            return reply.code(403).send({ error: 'confirmed' })
          }
          await db.query('delete from task_completions where task_id = $1 and occurrence_date = $2', [row.id, occurrence])
          if (!existing[0].pending) revoked = (await revokeRewards(db, row.id, occurrence, `Отмена: ${row.title}`, member.id)) > 0
        }
        await db.query('commit')
      } catch (err) {
        await db.query('rollback').catch(() => {})
        throw err
      } finally {
        db.release()
      }
      publish(member.family_id, { type: 'tasks' })
      if (revoked) publish(member.family_id, { type: 'members' })
      return reply.code(204).send()
    },
  )
}
