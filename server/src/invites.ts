import type { FastifyInstance } from 'fastify'
import { authenticate, normalizeEmail } from './auth.js'
import { pool } from './db.js'
import { mailBudgetExhausted } from './outbox/budget.js'
import { enqueue, PRIORITY } from './outbox/index.js'
import { issueInvite } from './routes.js'
import { MAX_FAMILY_MEMBERS } from './roles.js'

// Приглашение по email: владелец выбирает адрес (в приложении из контактов или вводит), сервер отправляет письмо со ссылкой на
// присоединение. Дальше человек сам проходит капчу, подтверждает адрес кодом и выбирает роль (это обычное вступление по ссылке).

// письмо ждёт отправки не дольше суток
const INVITE_MAIL_TTL_MINUTES = 24 * 60
// сколько писем-приглашений семья может отправить за сутки и как часто можно повторять один адрес
const DAILY_LIMIT = 20
const SAME_ADDRESS_PAUSE_MINUTES = 10
const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }

// Адрес сайта для ссылок в письмах. Берём только из настроек сервера: адрес из запроса позволил бы отправлять письма со ссылкой
// на любой чужой сайт от имени приложения.
export function publicUrl(): string {
  const explicit = process.env.PUBLIC_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const domain = process.env.DOMAIN?.trim()
  return domain ? `https://${domain}` : 'http://localhost:8080'
}

export const inviteLinkFor = (code: string, email: string) =>
  `${publicUrl()}/join?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`

const inviteEmailSchema = {
  body: {
    type: 'object',
    required: ['email'],
    additionalProperties: false,
    properties: { email: { type: 'string', format: 'email', maxLength: 254 } },
  },
}

export async function inviteRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string } }>('/api/invite/email', { schema: inviteEmailSchema, config: strictLimit }, async (req, reply) => {
    const me = await authenticate(req)
    if (!me) return reply.code(401).send({ error: 'unauthorized' })
    if (!me.is_owner) return reply.code(403).send({ error: 'forbidden' })
    const email = normalizeEmail(req.body.email)

    // Письма уходят в пределах дневного бюджета сервиса отправки
    if (await mailBudgetExhausted(pool)) return reply.code(503).send({ error: 'mail_busy' })

    const tx = await pool.connect()
    try {
      await tx.query('begin')
      // блокировка семьи: параллельные приглашения не обойдут лимиты
      await tx.query('select id from families where id = $1 for update', [me.family_id])

      const { rows: members } = await tx.query<{ email: string }>('select email from members where family_id = $1', [me.family_id])
      if (members.some((m) => m.email === email)) {
        await tx.query('rollback')
        return reply.code(409).send({ error: 'already_member' })
      }
      if (members.length >= MAX_FAMILY_MEMBERS) {
        await tx.query('rollback')
        return reply.code(409).send({ error: 'family_full' })
      }

      const { rows: recent } = await tx.query<{ day: string; same: string }>(
        `select count(*) filter (where created_at > now() - interval '1 day') as day,
                count(*) filter (where email = $2 and created_at > now() - make_interval(mins => $3)) as same
         from invite_emails where family_id = $1`,
        [me.family_id, email, SAME_ADDRESS_PAUSE_MINUTES],
      )
      if (Number(recent[0].same) > 0) {
        await tx.query('rollback')
        return reply.code(429).send({ error: 'too_soon' })
      }
      if (Number(recent[0].day) >= DAILY_LIMIT) {
        await tx.query('rollback')
        return reply.code(429).send({ error: 'invite_limit' })
      }

      // действующая ссылка семьи; если её нет или она истекла, выпускается новая (действующие ссылки не отзываются)
      const { rows: active } = await tx.query<{ code: string }>(
        `select code from invites where family_id = $1 and expires_at > now() order by created_at desc limit 1`,
        [me.family_id],
      )
      const code = active[0]?.code ?? (await issueInvite(tx, me.family_id)).code

      await tx.query('insert into invite_emails (family_id, email) values ($1, $2)', [me.family_id, email])
      await tx.query(`delete from invite_emails where created_at < now() - interval '7 days'`)
      await enqueue(tx, {
        channel: 'email',
        priority: PRIORITY.event,
        payload: { v: 1, kind: 'invite', to: email, inviterName: me.name, link: inviteLinkFor(code, email), ttlMinutes: INVITE_MAIL_TTL_MINUTES },
      })
      await tx.query('commit')
      return reply.code(204).send()
    } catch (err) {
      await tx.query('rollback').catch(() => {})
      throw err
    } finally {
      tx.release()
    }
  })
}
