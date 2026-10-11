import type { FastifyInstance } from 'fastify'
import { authorizeChild, type MemberParams } from './access.js'
import { publishForMember } from './realtime.js'
import { pool } from './db.js'

const MAX_LESSONS_PER_DAY = 12

const timeSchema = { type: ['string', 'null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' } as const

const saveScheduleSchema = {
  params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
  body: {
    type: 'object',
    required: ['lessons'],
    additionalProperties: false,
    properties: {
      lessons: {
        type: 'array',
        maxItems: MAX_LESSONS_PER_DAY * 6,
        items: {
          type: 'object',
          required: ['weekday', 'subject'],
          additionalProperties: false,
          properties: {
            weekday: { type: 'integer', minimum: 1, maximum: 6 },
            subject: { type: 'string', minLength: 1, maxLength: 60, pattern: '\\S' },
            startsAt: timeSchema,
            endsAt: timeSchema,
          },
        },
      },
    },
  },
}

const getScheduleSchema = {
  params: saveScheduleSchema.params,
}

interface LessonInput {
  weekday: number
  subject: string
  startsAt?: string | null
  endsAt?: string | null
}

export async function scheduleRoutes(app: FastifyInstance) {
  app.get<MemberParams>('/api/members/:id/schedule', { schema: getScheduleSchema }, async (req, reply) => {
    const memberId = await authorizeChild(req, reply)
    if (!memberId) return

    const { rows } = await pool.query(
      `select weekday, subject,
              to_char(starts_at, 'HH24:MI') as "startsAt",
              to_char(ends_at, 'HH24:MI') as "endsAt"
       from schedule_lessons where member_id = $1 order by weekday, position`,
      [memberId],
    )
    return { lessons: rows }
  })

  // расписание сохраняется целиком: порядок уроков в дне равен порядку в массиве
  app.put<MemberParams & { Body: { lessons: LessonInput[] } }>(
    '/api/members/:id/schedule',
    { schema: saveScheduleSchema },
    async (req, reply) => {
      const memberId = await authorizeChild(req, reply)
      if (!memberId) return

      const perDay = new Map<number, number>()
      for (const lesson of req.body.lessons) {
        const count = (perDay.get(lesson.weekday) ?? 0) + 1
        perDay.set(lesson.weekday, count)
        if (count > MAX_LESSONS_PER_DAY) return reply.code(400).send({ error: 'too_many_lessons' })
        if (lesson.startsAt && lesson.endsAt && lesson.endsAt <= lesson.startsAt) {
          return reply.code(400).send({ error: 'invalid_time' })
        }
      }

      const db = await pool.connect()
      try {
        await db.query('begin')
        await db.query('delete from schedule_lessons where member_id = $1', [memberId])

        const positions = new Map<number, number>()
        for (const lesson of req.body.lessons) {
          const position = (positions.get(lesson.weekday) ?? 0) + 1
          positions.set(lesson.weekday, position)
          await db.query(
            `insert into schedule_lessons (member_id, weekday, position, subject, starts_at, ends_at)
             values ($1, $2, $3, $4, $5, $6)`,
            [
              memberId,
              lesson.weekday,
              position,
              lesson.subject.trim(),
              lesson.startsAt || null,
              lesson.endsAt || null,
            ],
          )
        }
        await db.query('commit')
        void publishForMember(memberId, { type: 'schedule', memberId })
        return reply.code(204).send()
      } catch (err) {
        await db.query('rollback').catch(() => {})
        throw err
      } finally {
        db.release()
      }
    },
  )
}
