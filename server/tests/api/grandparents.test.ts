import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createSession } from '../../src/auth.js'
import { senderLabel } from '../../src/chat.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily, type TestMember } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let grandma: TestMember
let grandpa: TestMember
let suffix: string

async function addMember(family: TestFamily, name: string, role: string): Promise<TestMember> {
  const email = `${name.toLowerCase()}-${suffix}@test.local`
  const { rows } = await pool.query(
    `insert into members (family_id, name, email, role) values ($1, $2, $3, $4) returning id`,
    [family.id, name, email, role],
  )
  return { id: rows[0].id, name, email, token: await createSession(pool, rows[0].id) }
}

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  suffix = randomBytes(4).toString('hex')
  fam = await createFamily()
  grandma = await addMember(fam, 'Бабушка', 'grandma')
  grandpa = await addMember(fam, 'Дедушка', 'grandpa')
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await pool.query(`delete from outbox where channel = 'email' and payload->>'to' like $1`, [`%-${suffix}@gp.local`])
  await app.close()
  await pool.end()
})

const lastCode = async (to: string) =>
  (await pool.query(`select payload->>'code' as code from outbox where channel = 'email' and payload->>'to' = $1 order by id desc limit 1`, [to])).rows[0].code as string

const lesson = { weekday: 1, subject: 'Математика', startsAt: '09:00', endsAt: '09:45' }
const training = { weekday: 1, title: 'Плавание' }
const task = (over: object = {}) => ({ title: 'Задание', assigneeId: fam.kid.id, date: '2026-10-12', time: null, reward: 0, repeat: { type: 'none' }, ...over })

describe('бабушка и дедушка', () => {
  it('видят расписания и цели ребёнка', async () => {
    for (const who of [grandma, grandpa]) {
      expect((await api(app, who.token, 'GET', `/api/members/${fam.kid.id}/schedule`)).status).toBe(200)
      expect((await api(app, who.token, 'GET', `/api/members/${fam.kid.id}/trainings`)).status).toBe(200)
      expect((await api(app, who.token, 'GET', `/api/members/${fam.kid.id}/goals`)).status).toBe(200)
    }
  })

  it('не меняют расписания, тренировки и не ставят цели', async () => {
    for (const who of [grandma, grandpa]) {
      const s = await api(app, who.token, 'PUT', `/api/members/${fam.kid.id}/schedule`, { lessons: [lesson] })
      expect(s.status).toBe(403)
      expect(s.body.error).toBe('parents_only')
      expect((await api(app, who.token, 'PUT', `/api/members/${fam.kid.id}/trainings`, { trainings: [training] })).status).toBe(403)
      expect((await api(app, who.token, 'POST', `/api/members/${fam.kid.id}/goals`, { title: 'Велосипед', price: 100 })).status).toBe(403)
    }
    expect((await api(app, fam.mom.token, 'GET', `/api/members/${fam.kid.id}/schedule`)).body.lessons).toHaveLength(0)
  })

  it('родители по-прежнему меняют; цель бабушка не изменит и не удалит', async () => {
    expect((await api(app, fam.dad.token, 'PUT', `/api/members/${fam.kid.id}/schedule`, { lessons: [lesson] })).status).toBe(204)
    const goal = await api(app, fam.mom.token, 'POST', `/api/members/${fam.kid.id}/goals`, { title: 'Велосипед', price: 100 })
    expect(goal.status).toBe(201)
    const id = goal.body.goal.id
    expect((await api(app, grandma.token, 'PUT', `/api/goals/${id}`, { title: 'Х', price: 1 })).status).toBe(403)
    expect((await api(app, grandma.token, 'DELETE', `/api/goals/${id}`)).status).toBe(403)
    expect((await api(app, grandma.token, 'GET', `/api/goals/${id}`)).status).toBe(200)
  })

  it('не начисляют монеты в чате, но ставят реакции', async () => {
    const sent = await api(app, fam.kid.token, 'POST', '/api/chats/family/messages', { text: 'Привет' })
    const id = sent.body.message.id
    expect((await api(app, grandma.token, 'POST', `/api/chats/family/messages/${id}/feedback`, { coins: 10 })).status).toBe(403)
    expect((await api(app, grandma.token, 'POST', `/api/chats/family/messages/${id}/feedback`, { emoji: '👍' })).status).toBe(200)
    expect((await api(app, fam.mom.token, 'POST', `/api/chats/family/messages/${id}/feedback`, { coins: 10 })).status).toBe(200)
  })

  it('не очищают чат', async () => {
    expect((await api(app, grandma.token, 'DELETE', '/api/chats/family/messages')).status).toBe(403)
  })

  it('видят все задания семьи, но награду назначить не могут', async () => {
    expect((await api(app, fam.mom.token, 'POST', '/api/tasks', task({ title: 'Чужое задание' }))).status).toBe(201)
    const list = await api(app, grandpa.token, 'GET', '/api/tasks?from=2026-10-12&to=2026-10-12')
    expect(list.body.tasks.map((t: { title: string }) => t.title)).toContain('Чужое задание')
    const reward = await api(app, grandma.token, 'POST', '/api/tasks', task({ reward: 10 }))
    expect(reward.status).toBe(400)
    expect(reward.body.error).toBe('reward_requires_parent')
    expect((await api(app, grandma.token, 'POST', '/api/tasks', task())).status).toBe(201)
  })

  it('выполнение задания с наградой уходит на проверку, подтвердить может только родитель', async () => {
    const id = (await api(app, fam.mom.token, 'POST', '/api/tasks', task({ reward: 10, title: 'С наградой' }))).body.task.id
    const balance = async () => (await api(app, fam.kid.token, 'GET', '/api/me')).body.member.coins as number
    const before = await balance()
    const coins = async () => (await balance()) - before
    expect((await api(app, grandma.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })).status).toBe(204)
    expect(await coins()).toBe(0)
    expect((await api(app, grandpa.token, 'POST', `/api/tasks/${id}/confirm`, { date: '2026-10-12' })).status).toBe(403)
    // повторная отметка бабушкой монет не выдаёт
    expect((await api(app, grandma.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })).status).toBe(204)
    expect(await coins()).toBe(0)
    expect((await api(app, fam.dad.token, 'POST', `/api/tasks/${id}/confirm`, { date: '2026-10-12' })).status).toBe(204)
    expect(await coins()).toBe(10)
  })

  it('ребёнок видит их как «Бабушка» и «Дедушка» в уведомлениях', () => {
    expect(senderLabel({ name: 'Нина', role: 'grandma' }, 'child')).toBe('Бабушка')
    expect(senderLabel({ name: 'Иван', role: 'grandpa' }, 'child')).toBe('Дедушка')
    expect(senderLabel({ name: 'Нина', role: 'grandma' }, 'papa')).toBe('Нина')
  })
})

describe('состав семьи', () => {
  it('седьмого участника принять нельзя, шестой проходит', async () => {
    let n = 0
    const joinAs = async (name: string, role: string, code: string) => {
      const to = `${role}-${suffix}-${n++}@gp.local`
      expect((await api(app, null, 'POST', '/api/email-codes', { email: to, purpose: 'signup' })).status).toBe(204)
      return api(app, null, 'POST', `/api/invites/${code}/join`, { role, name, email: to, code: await lastCode(to) })
    }
    const small = await createFamily() // 4 участника
    try {
      const code = `inv-${small.id}`
      await pool.query(`insert into invites (family_id, code, expires_at) values ($1, $2, now() + interval '7 days')`, [small.id, code])
      const fifth = await joinAs('Нина', 'grandma', code)
      expect(fifth.status).toBe(201)
      expect(fifth.body.member.role).toBe('grandma')
      expect((await joinAs('Иван', 'grandpa', code)).status).toBe(201)
      const seventh = await joinAs('Лишний', 'child', code)
      expect(seventh.status).toBe(409)
      expect(seventh.body.error).toBe('family_full')
      const { rows } = await pool.query('select count(*)::int as n from members where family_id = $1', [small.id])
      expect(rows[0].n).toBe(6)
    } finally {
      await removeFamilies(small.id)
    }
  })

  it('семью создают только мама или папа', async () => {
    const to = `owner-${suffix}@gp.local`
    await api(app, null, 'POST', '/api/email-codes', { email: to, purpose: 'signup' })
    const res = await api(app, null, 'POST', '/api/families', { role: 'grandma', name: 'Нина', email: to, code: await lastCode(to) })
    expect(res.status).toBe(400)
  })
})
