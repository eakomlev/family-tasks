import type { FastifyInstance } from 'fastify'
import { authorizeChild, type MemberParams } from './access.js'
import { publishForMember } from './realtime.js'
import { pool } from './db.js'

const MAX_TRAININGS_PER_DAY = 8

const timeSchema = { type: ['string', 'null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' } as const

const idParams = { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }

const saveTrainingsSchema = {
  params: idParams,
  body: {
    type: 'object',
    required: ['trainings'],
    additionalProperties: false,
    properties: {
      trainings: {
        type: 'array',
        maxItems: MAX_TRAININGS_PER_DAY * 7,
        items: {
          type: 'object',
          required: ['weekday', 'title'],
          additionalProperties: false,
          properties: {
            weekday: { type: 'integer', minimum: 1, maximum: 7 },
            title: { type: 'string', minLength: 1, maxLength: 60, pattern: '\\S' },
            place: { type: ['string', 'null'], maxLength: 60 },
            startsAt: timeSchema,
            endsAt: timeSchema,
          },
        },
      },
    },
  },
}

interface TrainingInput {
  weekday: number
  title: string
  place?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

export async function trainingRoutes(app: FastifyInstance) {
  app.get<MemberParams>('/api/members/:id/trainings', { schema: { params: idParams } }, async (req, reply) => {
    const memberId = await authorizeChild(req, reply)
    if (!memberId) return

    const { rows } = await pool.query(
      `select weekday, title, place,
              to_char(starts_at, 'HH24:MI') as "startsAt",
              to_char(ends_at, 'HH24:MI') as "endsAt"
       from training_sessions where member_id = $1 order by weekday, position`,
      [memberId],
    )
    return { trainings: rows }
  })

  // расписание сохраняется целиком: порядок тренировок в дне равен порядку в массиве
  app.put<MemberParams & { Body: { trainings: TrainingInput[] } }>(
    '/api/members/:id/trainings',
    { schema: saveTrainingsSchema },
    async (req, reply) => {
      const memberId = await authorizeChild(req, reply, true)
      if (!memberId) return

      const perDay = new Map<number, number>()
      for (const training of req.body.trainings) {
        const count = (perDay.get(training.weekday) ?? 0) + 1
        perDay.set(training.weekday, count)
        if (count > MAX_TRAININGS_PER_DAY) return reply.code(400).send({ error: 'too_many_trainings' })
        if (training.startsAt && training.endsAt && training.endsAt <= training.startsAt) {
          return reply.code(400).send({ error: 'invalid_time' })
        }
      }

      const db = await pool.connect()
      try {
        await db.query('begin')
        await db.query('delete from training_sessions where member_id = $1', [memberId])

        const positions = new Map<number, number>()
        for (const training of req.body.trainings) {
          const position = (positions.get(training.weekday) ?? 0) + 1
          positions.set(training.weekday, position)
          await db.query(
            `insert into training_sessions (member_id, weekday, position, title, place, starts_at, ends_at)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [
              memberId,
              training.weekday,
              position,
              training.title.trim(),
              training.place?.trim() || null,
              training.startsAt || null,
              training.endsAt || null,
            ],
          )
        }
        await db.query('commit')
        void publishForMember(memberId, { type: 'trainings', memberId })
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
