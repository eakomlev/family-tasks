import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { buildApp } from '../../src/app.js'
import { createSession } from '../../src/auth.js'
import { pool } from '../../src/db.js'
import { CLOSE_UNAUTHORIZED, connectionCount } from '../../src/realtime.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let other: TestFamily
const open: WebSocket[] = []

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  other = await createFamily()
})
afterAll(async () => {
  for (const ws of open) ws.terminate()
  await removeFamilies(fam.id, other.id)
  await app.close()
  await pool.end()
})

// сообщения собираются с момента подключения; next() отдаёт следующее непрочитанное и при необходимости ждёт его
class Client {
  messages: any[] = []
  closed?: number
  private cursor = 0
  private waiters: (() => void)[] = []

  constructor(readonly ws: WebSocket) {
    ws.on('message', (raw: Buffer) => {
      this.messages.push(JSON.parse(raw.toString()))
      this.waiters.splice(0).forEach((w) => w())
    })
    ws.on('close', (code: number) => {
      this.closed = code
      this.waiters.splice(0).forEach((w) => w())
    })
  }

  async until(check: () => boolean, ms = 2000) {
    const deadline = Date.now() + ms
    while (!check()) {
      if (Date.now() > deadline) throw new Error(`не дождались; сообщения: ${JSON.stringify(this.messages)}, закрыто: ${this.closed}`)
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
    await new Promise((r) => setTimeout(r, ms))
    return this.messages.length === this.cursor
  }
}

async function connect(token?: string) {
  const ws = await app.injectWS('/api/ws')
  open.push(ws)
  const client = new Client(ws)
  if (token !== undefined) ws.send(JSON.stringify({ type: 'auth', token }))
  return client
}

async function connectAuthed(token: string) {
  const client = await connect(token)
  expect(await client.next()).toEqual({ type: 'ready' })
  return client
}

describe('вход в сокет', () => {
  it('с верным токеном приходит ready и соединение учитывается', async () => {
    const before = connectionCount()
    await connectAuthed(fam.mom.token)
    expect(connectionCount()).toBe(before + 1)
  })

  it('неверный токен закрывает соединение кодом 4401', async () => {
    const client = await connect('чужой-токен')
    await client.until(() => client.closed !== undefined)
    expect(client.closed).toBe(CLOSE_UNAUTHORIZED)
    expect(client.messages).toEqual([])
  })

  it('не JSON и сообщение другого вида тоже отклоняются', async () => {
    const garbage = await connect()
    garbage.ws.send('это не json')
    await garbage.until(() => garbage.closed !== undefined)
    expect(garbage.closed).toBe(CLOSE_UNAUTHORIZED)

    const wrongType = await connect()
    wrongType.ws.send(JSON.stringify({ type: 'hello', token: fam.mom.token }))
    await wrongType.until(() => wrongType.closed !== undefined)
    expect(wrongType.closed).toBe(CLOSE_UNAUTHORIZED)
  })

  it('токен не строка: закрывается без ошибки сервера', async () => {
    const client = await connect()
    client.ws.send(JSON.stringify({ type: 'auth', token: { $ne: null } }))
    await client.until(() => client.closed !== undefined)
    expect(client.closed).toBe(CLOSE_UNAUTHORIZED)
  })

  it('после выхода (DELETE /api/session) соединение этого устройства закрывается', async () => {
    const token = await createSession(pool, fam.kid.id)
    const device = await connectAuthed(token)
    const another = await connectAuthed(fam.kid.token)

    expect((await api(app, token, 'DELETE', '/api/session')).status).toBe(204)
    await device.until(() => device.closed !== undefined)
    expect(device.closed).toBe(CLOSE_UNAUTHORIZED)
    expect(another.closed).toBeUndefined()
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

  it('отказ в доступе к расписанию событий не порождает', async () => {
    const dad = await connectAuthed(fam.dad.token)
    expect((await api(app, fam.kid.token, 'PUT', `/api/members/${fam.sis.id}/schedule`, { lessons: [] })).status).toBe(403)
    expect(await dad.quiet()).toBe(true)
  })
})
