import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'

let app: Awaited<ReturnType<typeof buildApp>>
let a: TestFamily
let b: TestFamily
beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  a = await createFamily()
  b = await createFamily()
})
afterAll(async () => {
  await removeFamilies(a.id, b.id)
  await app.close()
  await pool.end()
})

describe('связи между семьями', () => {
  it('взрослый отправляет запрос по коду, семья принимает; дети не могут управлять связью', async () => {
    const { rows: [target] } = await pool.query('select code from families where id = $1', [b.id])
    expect((await api(app, a.kid.token, 'POST', '/api/family/connections/requests', { familyCode: target.code, surname: 'Ивановы' })).status).toBe(403)
    const sent = await api(app, a.mom.token, 'POST', '/api/family/connections/requests', { familyCode: target.code, surname: 'Ивановы' })
    expect(sent.status).toBe(201)
    const childInbox = await api(app, b.kid.token, 'GET', '/api/family/connections')
    expect(childInbox.body.requests).toEqual([])
    const inbox = await api(app, b.mom.token, 'GET', '/api/family/connections')
    expect(inbox.body.requests[0].fromSurname).toBe('Ивановы')
    expect((await api(app, b.kid.token, 'POST', `/api/family/connections/requests/${sent.body.id}`, { action: 'accept', surname: 'Петровы' })).status).toBe(403)
    expect((await api(app, b.mom.token, 'POST', `/api/family/connections/requests/${sent.body.id}`, { action: 'accept', surname: 'Петровы' })).status).toBe(204)
    expect((await api(app, a.mom.token, 'GET', '/api/family/connections')).body.connections).toHaveLength(1)
    expect((await api(app, a.mom.token, 'GET', '/api/chats')).body.chats.some((chat: { id: string }) => chat.id === b.kid.id)).toBe(true)
    const message = await api(app, a.mom.token, 'POST', `/api/chats/${b.kid.id}/messages`, { text: 'Привет!' })
    expect(message.status).toBe(201)
    expect((await api(app, b.kid.token, 'GET', `/api/chats/${a.mom.id}/messages`)).body.messages[0].text).toBe('Привет!')
    const invitedGame = await api(app, a.mom.token, 'POST', '/api/games', { kind: 'chess', opponentId: b.kid.id })
    expect(invitedGame.status).toBe(201)
    expect((await api(app, b.kid.token, 'GET', '/api/games')).body.games).toHaveLength(1)
    const sharedEvent = await api(app, a.mom.token, 'POST', '/api/events', {
      title: 'Пикник вместе', startDate: '2026-11-01', endDate: '2026-11-01', allFamily: false,
      memberIds: [b.kid.id], familyIds: [b.id],
    })
    expect(sharedEvent.status).toBe(201)
    expect((await api(app, b.kid.token, 'GET', '/api/events?from=2026-11-01&to=2026-11-01')).body.events).toHaveLength(1)
    expect((await api(app, b.dad.token, 'DELETE', `/api/family/connections/${a.id}`)).status).toBe(403)
    expect((await api(app, b.dad.token, 'DELETE', `/api/family/connections/${a.id}`)).body.error).toBe('owner_only')
    expect((await api(app, b.mom.token, 'DELETE', `/api/family/connections/${a.id}`)).status).toBe(204)
    expect((await api(app, b.kid.token, 'GET', `/api/chats/${a.mom.id}/messages`)).status).toBe(404)
    expect((await api(app, b.kid.token, 'GET', `/api/games/${invitedGame.body.game.id}`)).status).toBe(404)
    expect((await pool.query('select status from games where id = $1', [invitedGame.body.game.id])).rows[0].status).toBe('cancelled')
    expect((await api(app, b.kid.token, 'GET', '/api/events?from=2026-11-01&to=2026-11-01')).body.events).toHaveLength(0)
    expect((await api(app, a.mom.token, 'GET', '/api/events?from=2026-11-01&to=2026-11-01')).body.events).toHaveLength(1)
  })
})
