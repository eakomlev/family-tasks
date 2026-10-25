import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { hashToken } from '../../src/auth.js'
import { CLOSE_UNAUTHORIZED, startRealtime, type Realtime } from '../../src/app.js'
import { REALTIME_CHANNEL } from '../../src/contract.js'
import { isAlive } from '../../src/state.js'
import { addSession, createFamily, pool, removeFamilies, sleep, waitFor, type TestFamily } from '../helpers.js'

const sample = JSON.parse(readFileSync(new URL('../../../contracts/realtime-v1.json', import.meta.url), 'utf8'))
const INSTANCE = 'test-instance'

let service: Realtime
let fam: TestFamily
let other: TestFamily
const open: WebSocket[] = []

beforeAll(async () => {
  service = await startRealtime({
    pool,
    connectionString: process.env.DATABASE_URL!,
    log: () => {},
    port: 0,
    instance: INSTANCE,
    pingIntervalMs: 150,
    sessionCheckMs: 150,
    beatMs: 150,
  })
  fam = await createFamily()
  other = await createFamily()
  await waitFor(() => service.isListening())
})
afterAll(async () => {
  for (const ws of open) ws.terminate()
  await service.close()
  await removeFamilies(fam.id, other.id)
  await pool.end()
})

// сообщения собираются с момента подключения; next() отдаёт следующее непрочитанное и при необходимости ждёт его
class Client {
  messages: unknown[] = []
  closed?: number
  private cursor = 0

  constructor(readonly ws: WebSocket) {
    ws.on('error', () => {})
    ws.on('message', (raw: Buffer) => this.messages.push(JSON.parse(raw.toString())))
    ws.on('close', (code: number) => {
      this.closed = code
    })
  }

  async next() {
    await waitFor(() => this.messages.length > this.cursor)
    return this.messages[this.cursor++]
  }

  async quiet(ms = 250) {
    await sleep(ms)
    return this.messages.length === this.cursor
  }

  waitClosed() {
    return waitFor(() => this.closed !== undefined).then(() => this.closed)
  }
}

function connect(token?: unknown, path = '/api/ws') {
  const ws = new WebSocket(`ws://127.0.0.1:${service.port}${path}`)
  open.push(ws)
  const client = new Client(ws)
  if (token !== undefined) ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })))
  return client
}

async function connectAuthed(token: string) {
  const client = connect(token)
  expect(await client.next()).toEqual({ type: 'ready' })
  return client
}

const notify = (message: object) => pool.query('select pg_notify($1, $2)', [REALTIME_CHANNEL, JSON.stringify(message)])
const family = (event: object, familyId = fam.id) => notify({ v: 1, to: 'family', id: familyId, event })
const viewing = (memberId: string) => pool.query('select chat from realtime_viewing where member_id = $1 order by chat', [memberId]).then((r) => r.rows.map((x) => x.chat))

describe('вход в сокет', () => {
  it('с верным токеном приходит ready и соединение учитывается', async () => {
    const before = service.hub.size
    await connectAuthed(fam.mom.token)
    expect(service.hub.size).toBe(before + 1)
  })

  it('неверный токен закрывает соединение кодом 4401', async () => {
    const client = connect('чужой-токен')
    expect(await client.waitClosed()).toBe(CLOSE_UNAUTHORIZED)
    expect(client.messages).toEqual([])
  })

  it('не JSON и сообщение другого вида тоже отклоняются, токен не строка тоже', async () => {
    const garbage = connect()
    garbage.ws.on('open', () => garbage.ws.send('это не json'))
    expect(await garbage.waitClosed()).toBe(CLOSE_UNAUTHORIZED)

    const wrongType = connect()
    wrongType.ws.on('open', () => wrongType.ws.send(JSON.stringify({ type: 'hello', token: fam.mom.token })))
    expect(await wrongType.waitClosed()).toBe(CLOSE_UNAUTHORIZED)

    const object = connect({ $ne: null })
    expect(await object.waitClosed()).toBe(CLOSE_UNAUTHORIZED)
  })

  it('чужой адрес не принимается', async () => {
    const wrongPath = connect(undefined, '/api/other')
    await waitFor(() => wrongPath.closed !== undefined || wrongPath.ws.readyState === WebSocket.CLOSED)
    expect(wrongPath.messages).toEqual([])
  })
})

describe('доставка сигналов из канала', () => {
  it('сигнал семьи получают все её устройства и не получает чужая семья', async () => {
    const mom = await connectAuthed(fam.mom.token)
    const kid = await connectAuthed(fam.kid.token)
    const stranger = await connectAuthed(other.mom.token)

    await family({ type: 'tasks' })
    expect(await mom.next()).toEqual({ type: 'tasks' })
    expect(await kid.next()).toEqual({ type: 'tasks' })
    expect(await stranger.quiet()).toBe(true)
  })

  it('сигнал участнику идёт на все его устройства и больше никому', async () => {
    const mom1 = await connectAuthed(fam.mom.token)
    const mom2 = await connectAuthed(await addSession(fam.mom.id))
    const kid = await connectAuthed(fam.kid.token)

    await notify({ v: 1, to: 'member', id: fam.mom.id, event: { type: 'chat', chat: 'family' } })
    expect(await mom1.next()).toEqual({ type: 'chat', chat: 'family' })
    expect(await mom2.next()).toEqual({ type: 'chat', chat: 'family' })
    expect(await kid.quiet()).toBe(true)
  })

  it('образцы контракта доставляются как есть', async () => {
    const kid = await connectAuthed(fam.kid.token)
    await notify({ ...sample.family, id: fam.id })
    expect(await kid.next()).toEqual(sample.family.event)
    await notify({ ...sample.member, id: fam.kid.id })
    expect(await kid.next()).toEqual(sample.member.event)
  })

  it('непонятные сообщения канала игнорируются', async () => {
    const kid = await connectAuthed(fam.kid.token)
    await pool.query('select pg_notify($1, $2)', [REALTIME_CHANNEL, 'не json'])
    await notify({ v: 2, to: 'family', id: fam.id, event: { type: 'tasks' } })
    expect(await kid.quiet()).toBe(true)
    // и сервис после них жив
    await family({ type: 'members' })
    expect(await kid.next()).toEqual({ type: 'members' })
  })

  it('закрытие сессии: закрывается только то устройство, чей токен', async () => {
    const token = await addSession(fam.kid.id)
    const device = await connectAuthed(token)
    const another = await connectAuthed(fam.kid.token)

    await notify({ v: 1, to: 'session', id: hashToken(token) })
    expect(await device.waitClosed()).toBe(CLOSE_UNAUTHORIZED)
    expect(another.closed).toBeUndefined()
  })

  it('отозванная без сигнала сессия закрывается по проверке', async () => {
    const token = await addSession(fam.kid.id)
    const device = await connectAuthed(token)
    await pool.query('delete from sessions where token_hash = $1', [hashToken(token)])
    expect(await device.waitClosed()).toBe(CLOSE_UNAUTHORIZED)
  })

  it('лишние подключения участника вытесняют самые старые', async () => {
    const member = await createFamily()
    try {
      const first = await connectAuthed(member.mom.token)
      for (let i = 0; i < 30; i++) await connectAuthed(member.mom.token)
      expect(await first.waitClosed()).toBe(1012)
      expect(service.hub.ofMember(member.mom.id).length).toBe(30)
    } finally {
      await removeFamilies(member.id)
    }
  })
})

describe('какой чат открыт', () => {
  it('вход и выход из чата пишутся в БД, закрытие соединения тоже убирает запись', async () => {
    const client = await connectAuthed(fam.mom.token)
    client.ws.send(JSON.stringify({ type: 'viewing', chat: 'family' }))
    await waitFor(async () => (await viewing(fam.mom.id)).includes('family'))
    client.ws.send(JSON.stringify({ type: 'viewing', chat: null }))
    await waitFor(async () => !(await viewing(fam.mom.id)).includes('family'))

    client.ws.send(JSON.stringify({ type: 'viewing', chat: 'game-1' }))
    await waitFor(async () => (await viewing(fam.mom.id)).includes('game-1'))
    client.ws.close()
    await waitFor(async () => (await viewing(fam.mom.id)).length === 0)
  })

  it('отметка освежается каждым ping, пока устройство отвечает', async () => {
    const client = await connectAuthed(fam.kid.token)
    client.ws.send(JSON.stringify({ type: 'viewing', chat: 'family' }))
    await waitFor(async () => (await viewing(fam.kid.id)).length === 1)
    const read = async () => (await pool.query('select updated_at from realtime_viewing where member_id = $1', [fam.kid.id])).rows[0].updated_at as Date
    const first = await read()
    await waitFor(async () => (await read()).getTime() > first.getTime())
  })

  it('визит в личный чат записывается, собеседнику уходит сигнал, у общего чата визитов нет', async () => {
    const kid = await connectAuthed(fam.kid.token)
    const mom = await connectAuthed(fam.mom.token)
    const key = fam.mom.id < fam.kid.id ? `${fam.mom.id}:${fam.kid.id}` : `${fam.kid.id}:${fam.mom.id}`

    // мама открывает личный чат с ребёнком: ребёнку уходит сигнал, чат с точки зрения ребёнка называется по маме
    mom.ws.send(JSON.stringify({ type: 'viewing', chat: fam.kid.id }))
    expect(await kid.next()).toEqual({ type: 'chat', chat: fam.mom.id })
    const { rows } = await pool.query('select 1 from chat_visits where member_id = $1 and chat_key = $2', [fam.mom.id, key])
    expect(rows.length).toBe(1)

    // выход тоже сообщает
    mom.ws.send(JSON.stringify({ type: 'viewing', chat: 'family' }))
    expect(await kid.next()).toEqual({ type: 'chat', chat: fam.mom.id })
    expect(await kid.quiet()).toBe(true)
    const visits = await pool.query(`select count(*)::int as n from chat_visits where member_id = $1 and chat_key in ('family')`, [fam.mom.id])
    expect(visits.rows[0].n).toBe(0)
  })
})

describe('эксплуатация', () => {
  it('метка живости ставится, пока слушается канал', async () => {
    await waitFor(() => isAlive(pool, INSTANCE, 5))
    const { rows } = await pool.query('select connections from realtime_state where instance = $1', [INSTANCE])
    expect(rows[0].connections).toBeGreaterThanOrEqual(0)
  })

  it('после обрыва слушателя сокеты закрываются (клиенты обновятся) и рассылка продолжается', async () => {
    const mom = await connectAuthed(fam.mom.token)
    const { rows } = await pool.query(
      `select pid from pg_stat_activity where datname = current_database() and query = 'listen ${REALTIME_CHANNEL}' and pid <> pg_backend_pid()`,
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) await pool.query('select pg_terminate_backend($1)', [row.pid])

    expect(await mom.waitClosed()).toBe(1012)
    await waitFor(() => service.isListening())

    const again = await connectAuthed(fam.mom.token)
    await family({ type: 'events' })
    expect(await again.next()).toEqual({ type: 'events' })
  })
})

