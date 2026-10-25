import { readFileSync } from 'node:fs'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createSession } from '../../src/auth.js'
import { hashToken } from '../../src/codes.js'
import { pool } from '../../src/db.js'
import { flushRealtime, REALTIME_CHANNEL, type RealtimeMessage } from '../../src/realtime.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

// Сокеты держит отдельный сервис realtime/ (его тесты там же), а server только пишет сигналы в канал Postgres. Здесь проверяем,
// что нужные сигналы уходят нужным адресатам: «клиент» ниже слушает канал и принимает то, что получил бы участник этого устройства.
let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let other: TestFamily
let listener: pg.Client
const clients: Client[] = []
const raws: RealtimeMessage[] = []

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  other = await createFamily()
  listener = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await listener.connect()
  listener.on('notification', (n) => {
    const message = JSON.parse(n.payload ?? '{}') as RealtimeMessage
    raws.push(message)
    for (const client of clients) client.deliver(message)
  })
  await listener.query(`listen ${REALTIME_CHANNEL}`)
})
afterAll(async () => {
  await flushRealtime()
  await listener.end()
  await removeFamilies(fam.id, other.id)
  await app.close()
  await pool.end()
})

// Сигнал доходит через Postgres уже после ответа API: чтобы запоздавший сигнал прошлого теста не попал в следующий, перед подключением
// и перед проверкой тишины ждём «барьер»: сообщение, отправленное после всех прежних и пришедшее следом за ними.
let barrierId = 0
async function settle() {
  await flushRealtime()
  const id = `barrier-${++barrierId}`
  await pool.query('select pg_notify($1, $2)', [REALTIME_CHANNEL, JSON.stringify({ v: 1, to: 'session', id })])
  const deadline = Date.now() + 3000
  while (!raws.some((m) => m.id === id)) {
    if (Date.now() > deadline) throw new Error('барьер не дошёл')
    await new Promise((r) => setTimeout(r, 10))
  }
}

// сообщения собираются с момента подключения; next() отдаёт следующее непрочитанное и при необходимости ждёт его
class Client {
  messages: any[] = []
  private cursor = 0
  private waiters: (() => void)[] = []

  constructor(
    readonly memberId: string,
    readonly familyId: string,
  ) {}

  // то же правило, что у сервиса realtime: семье всем её участникам, участнику только ему
  deliver(message: RealtimeMessage) {
    if (message.to === 'session') return
    if ((message.to === 'family' && message.id === this.familyId) || (message.to === 'member' && message.id === this.memberId)) {
      this.messages.push(message.event)
      this.waiters.splice(0).forEach((w) => w())
    }
  }

  async until(check: () => boolean, ms = 2000) {
    const deadline = Date.now() + ms
    while (!check()) {
      if (Date.now() > deadline) throw new Error(`не дождались; сообщения: ${JSON.stringify(this.messages)}`)
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve)
        setTimeout(resolve, 50)
      })
    }
  }

  async next() {
    await this.until(() => this.messages.length > this.cursor)
    return this.messages[this.cursor++]
  }

  // непрочитанных сообщений нет и не появилось: даём время дойти возможным
  async quiet(ms = 200) {
    await settle()
    await new Promise((r) => setTimeout(r, ms))
    return this.messages.length === this.cursor
  }
}

async function connectAuthed(token: string) {
  await settle()
  const { rows } = await pool.query(
    'select s.member_id as "memberId", m.family_id as "familyId" from sessions s join members m on m.id = s.member_id where s.token_hash = $1',
    [hashToken(token)],
  )
  const client = new Client(rows[0].memberId, rows[0].familyId)
  clients.push(client)
  return client
}

describe('канал', () => {
  it('сообщения совпадают с образцом контракта', async () => {
    const sample = JSON.parse(readFileSync(new URL('../../../contracts/realtime-v1.json', import.meta.url), 'utf8'))
    const before = raws.length
    await api(app, fam.mom.token, 'PATCH', '/api/me', { name: `${fam.mom.name} 2` })
    await settle()
    // канал общий для всех семей (в том числе тестовых из соседних файлов): берём сообщение своей семьи
    const sent = raws.slice(before).find((m) => m.to === 'family' && m.id === fam.id)
    expect(sent).toEqual({ ...sample.family, id: fam.id, event: { type: 'members' } })
    await api(app, fam.mom.token, 'PATCH', '/api/me', { name: fam.mom.name })
  })

  it('после выхода (DELETE /api/session) в канал уходит закрытие сессии этого устройства', async () => {
    const token = await createSession(pool, fam.kid.id)
    const before = raws.length
    expect((await api(app, token, 'DELETE', '/api/session')).status).toBe(204)
    await settle()
    expect(raws.slice(before)).toContainEqual({ v: 1, to: 'session', id: hashToken(token) })
  })
})

describe('события', () => {
  const task = () => ({
    title: 'Вынести мусор',
    assigneeId: fam.kid.id,
    date: '2026-10-12',
    time: null,
    repeat: { type: 'none' },
  })

  it('изменения заданий приходят всей семье и не приходят чужой', async () => {
    const mom = await connectAuthed(fam.mom.token)
    const kid = await connectAuthed(fam.kid.token)
    const stranger = await connectAuthed(other.mom.token)

    const created = await api(app, fam.mom.token, 'POST', '/api/tasks', task())
    expect(await kid.next()).toEqual({ type: 'tasks' })
    // автору тоже: так обновятся его другие устройства
    expect(await mom.next()).toEqual({ type: 'tasks' })

    const id = created.body.task.id
    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/complete`, { date: '2026-10-12' })
    expect(await mom.next()).toEqual({ type: 'tasks' })
    await api(app, fam.kid.token, 'POST', `/api/tasks/${id}/uncomplete`, { date: '2026-10-12' })
    expect(await mom.next()).toEqual({ type: 'tasks' })
    await api(app, fam.mom.token, 'PUT', `/api/tasks/${id}`, task())
    expect(await mom.next()).toEqual({ type: 'tasks' })
    await api(app, fam.mom.token, 'DELETE', `/api/tasks/${id}`)
    expect(await mom.next()).toEqual({ type: 'tasks' })

    expect(await stranger.quiet()).toBe(true)
  })

  it('событие не содержит данных задания', async () => {
    const mom = await connectAuthed(fam.mom.token)
    const created = await api(app, fam.mom.token, 'POST', '/api/tasks', { ...task(), title: 'Секретное название' })
    const message = await mom.next()
    expect(JSON.stringify(message)).not.toContain('Секретное')
    await api(app, fam.mom.token, 'DELETE', `/api/tasks/${created.body.task.id}`)
  })

  it('неудавшийся запрос событий не порождает', async () => {
    const mom = await connectAuthed(fam.mom.token)
    expect((await api(app, fam.mom.token, 'POST', '/api/tasks', { ...task(), title: '   ' })).status).toBe(400)
    expect((await api(app, fam.kid.token, 'DELETE', '/api/tasks/00000000-0000-4000-8000-000000000000')).status).toBe(404)
    expect(await mom.quiet()).toBe(true)
  })

  it('профиль: members', async () => {
    const dad = await connectAuthed(fam.dad.token)
    await api(app, fam.kid.token, 'PATCH', '/api/me', { name: 'Ребёнок 2' })
    expect(await dad.next()).toEqual({ type: 'members' })
    await api(app, fam.kid.token, 'PATCH', '/api/me', { name: 'Ребёнок' })
  })

  it('расписания: с id ребёнка', async () => {
    const dad = await connectAuthed(fam.dad.token)
    await api(app, fam.kid.token, 'PUT', `/api/members/${fam.kid.id}/schedule`, { lessons: [] })
    expect(await dad.next()).toEqual({ type: 'schedule', memberId: fam.kid.id })
    await api(app, fam.mom.token, 'PUT', `/api/members/${fam.sis.id}/trainings`, { trainings: [] })
    expect(await dad.next()).toEqual({ type: 'trainings', memberId: fam.sis.id })
  })

  it('чат: общий сигнал всем, с чатом глазами получателя; личный только двоим и без текста', async () => {
    const mom = await connectAuthed(fam.mom.token)
    const dad = await connectAuthed(fam.dad.token)
    const kid = await connectAuthed(fam.kid.token)

    await api(app, fam.mom.token, 'POST', '/api/chats/family/messages', { text: 'секретный текст' })
    expect(await dad.next()).toEqual({ type: 'chat', chat: 'family' })
    expect(await kid.next()).toEqual({ type: 'chat', chat: 'family' })
    expect(await mom.next()).toEqual({ type: 'chat', chat: 'family' })

    await api(app, fam.mom.token, 'POST', `/api/chats/${fam.dad.id}/messages`, { text: 'личное' })
    // папе чат называется по собеседнику (маме), маме по папе
    expect(await dad.next()).toEqual({ type: 'chat', chat: fam.mom.id })
    expect(await mom.next()).toEqual({ type: 'chat', chat: fam.dad.id })
    // ребёнок о личной переписке родителей не узнаёт вообще
    expect(await kid.quiet()).toBe(true)
    expect(JSON.stringify([...dad.messages, ...kid.messages])).not.toContain('секретный')
  })

  it('прочтение сообщает другим устройствам этого же участника', async () => {
    const dad1 = await connectAuthed(fam.dad.token)
    const dad2 = await connectAuthed(fam.dad.token)
    const mom = await connectAuthed(fam.mom.token)
    await api(app, fam.mom.token, 'POST', '/api/chats/family/messages', { text: 'для папы' })
    expect(await dad1.next()).toEqual({ type: 'chat', chat: 'family' })
    expect(await dad2.next()).toEqual({ type: 'chat', chat: 'family' })
    expect(await mom.next()).toEqual({ type: 'chat', chat: 'family' })

    await api(app, fam.dad.token, 'POST', '/api/chats/family/read')
    expect(await dad1.next()).toEqual({ type: 'chat', chat: 'family' })
    expect(await dad2.next()).toEqual({ type: 'chat', chat: 'family' })
    // автор сообщения узнаёт, что его прочитали (галочки)
    expect(await mom.next()).toEqual({ type: 'chat', chat: 'family' })

    // повторная отметка без новых сообщений тишины не нарушает (иначе открытая переписка зациклится)
    await api(app, fam.dad.token, 'POST', '/api/chats/family/read')
    expect(await dad1.quiet()).toBe(true)
    expect(await dad2.quiet()).toBe(true)
    expect(await mom.quiet()).toBe(true)
  })

  it('личный чат: прочтение собеседником сообщает автору сообщения, чат глазами автора', async () => {
    const mom = await connectAuthed(fam.mom.token)
    const kid = await connectAuthed(fam.kid.token)
    await api(app, fam.mom.token, 'POST', `/api/chats/${fam.kid.id}/messages`, { text: 'прочитай' })
    expect(await mom.next()).toEqual({ type: 'chat', chat: fam.kid.id })
    expect(await kid.next()).toEqual({ type: 'chat', chat: fam.mom.id })

    await api(app, fam.kid.token, 'POST', `/api/chats/${fam.mom.id}/read`)
    expect(await kid.next()).toEqual({ type: 'chat', chat: fam.mom.id })
    expect(await mom.next()).toEqual({ type: 'chat', chat: fam.kid.id })
  })

  it('награда за задание: сигнал members, чтобы баланс обновился у всех открытых экранов', async () => {
    const kid = await connectAuthed(fam.kid.token)
    const created = await api(app, fam.mom.token, 'POST', '/api/tasks', {
      title: 'С наградой', assigneeId: fam.kid.id, reward: 10, date: '2026-10-12', time: null, repeat: { type: 'none' },
    })
    expect(await kid.next()).toEqual({ type: 'tasks' })
    await api(app, fam.kid.token, 'POST', `/api/tasks/${created.body.task.id}/complete`, { date: '2026-10-12' })
    // ребёнок только отправил на проверку: изменились задания, баланс нет
    expect(await kid.next()).toEqual({ type: 'tasks' })
    expect(await kid.quiet()).toBe(true)
    await api(app, fam.mom.token, 'POST', `/api/tasks/${created.body.task.id}/confirm`, { date: '2026-10-12' })
    expect(await kid.next()).toEqual({ type: 'tasks' })
    expect(await kid.next()).toEqual({ type: 'members' })
    await api(app, fam.mom.token, 'POST', `/api/tasks/${created.body.task.id}/uncomplete`, { date: '2026-10-12' })
    expect(await kid.next()).toEqual({ type: 'tasks' })
    expect(await kid.next()).toEqual({ type: 'members' })
  })

  it('реакция и монеты родителя: сигнал чата участникам (с их точки зрения), монеты ещё и сигнал members', async () => {
    const mom = await connectAuthed(fam.mom.token)
    const kid = await connectAuthed(fam.kid.token)
    const dad = await connectAuthed(fam.dad.token)
    const sent = await api(app, fam.kid.token, 'POST', `/api/chats/${fam.mom.id}/messages`, { text: 'мам' })
    expect(await mom.next()).toEqual({ type: 'chat', chat: fam.kid.id })
    expect(await kid.next()).toEqual({ type: 'chat', chat: fam.mom.id })

    // только реакция: чат обновляется у двоих, баланс не трогаем, папа ничего не узнаёт
    await api(app, fam.mom.token, 'POST', `/api/chats/${fam.kid.id}/messages/${sent.body.message.id}/feedback`, { emoji: '👍' })
    expect(await mom.next()).toEqual({ type: 'chat', chat: fam.kid.id })
    expect(await kid.next()).toEqual({ type: 'chat', chat: fam.mom.id })
    expect(await kid.quiet()).toBe(true)

    // монеты: ещё и members (баланс)
    await api(app, fam.mom.token, 'POST', `/api/chats/${fam.kid.id}/messages/${sent.body.message.id}/feedback`, { coins: 5 })
    expect(await mom.next()).toEqual({ type: 'chat', chat: fam.kid.id })
    expect(await kid.next()).toEqual({ type: 'chat', chat: fam.mom.id })
    expect(await kid.next()).toEqual({ type: 'members' })
    expect(await dad.next()).toEqual({ type: 'members' })
    expect(JSON.stringify(dad.messages)).not.toContain('chat')
  })

  it('отказ в доступе к расписанию событий не порождает', async () => {
    const dad = await connectAuthed(fam.dad.token)
    expect((await api(app, fam.kid.token, 'PUT', `/api/members/${fam.sis.id}/schedule`, { lessons: [] })).status).toBe(403)
    expect(await dad.quiet()).toBe(true)
  })
})

describe('игры', () => {
  it('приглашение, принятие, ход и сдача: сигнал games получают оба игрока, остальные не получают', async () => {
    const mom = await connectAuthed(fam.mom.token)
    const kid = await connectAuthed(fam.kid.token)
    const dad = await connectAuthed(fam.dad.token)
    const stranger = await connectAuthed(other.mom.token)

    const invited = await api(app, fam.mom.token, 'POST', '/api/games', { kind: 'chess', opponentId: fam.kid.id })
    const id = invited.body.game.id as string
    expect(await mom.next()).toEqual({ type: 'games' })
    expect(await kid.next()).toEqual({ type: 'games' })

    const accepted = await api(app, fam.kid.token, 'POST', `/api/games/${id}/accept`)
    expect(await mom.next()).toEqual({ type: 'games' })
    expect(await kid.next()).toEqual({ type: 'games' })

    // ходит тот, кому достались белые
    const whiteIsMom = accepted.body.game.whiteId === fam.mom.id
    const white = whiteIsMom ? fam.mom : fam.kid
    await api(app, white.token, 'POST', `/api/games/${id}/move`, { from: 'e2', to: 'e4' })
    expect(await mom.next()).toEqual({ type: 'games' })
    expect(await kid.next()).toEqual({ type: 'games' })

    await api(app, white.token, 'POST', `/api/games/${id}/resign`)
    expect(await mom.next()).toEqual({ type: 'games' })
    expect(await kid.next()).toEqual({ type: 'games' })

    // другие члены семьи и чужая семья о чужой партии не узнают
    expect(await dad.quiet()).toBe(true)
    expect(await stranger.quiet()).toBe(true)
  })
})
