import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let endpoints: Record<'mom' | 'dad', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  endpoints = { mom: await subscribe(fam.mom.id), dad: await subscribe(fam.dad.id) }
})
beforeEach(async () => {
  await resetSent()
  // у пары одна открытая игра каждого вида: убираем прошлую партию
  await pool.query('delete from games where family_id = $1', [fam.id])
})
afterAll(async () => {
  await removeFamilies(fam.id)
  await app.close()
  await pool.end()
})

const place = (token: string, id: string, cell: number) => api(app, token, 'POST', `/api/games/${id}/place`, { cell })

// начатая партия мамы (пригласила) и папы; x ходит первым
async function start() {
  const created = await api(app, fam.mom.token, 'POST', '/api/games', { kind: 'tictactoe', opponentId: fam.dad.id })
  expect(created.status).toBe(201)
  const id = created.body.game.id as string
  const accepted = await api(app, fam.dad.token, 'POST', `/api/games/${id}/accept`)
  const momFirst = accepted.body.game.whiteId === fam.mom.id
  return { id, x: momFirst ? fam.mom : fam.dad, o: momFirst ? fam.dad : fam.mom, game: accepted.body.game }
}

describe('крестики-нолики', () => {
  it('приглашение создаёт пустое поле, ходит первым тот, кто в whiteId', async () => {
    const { game, x } = await start()
    expect(game).toMatchObject({ kind: 'tictactoe', status: 'active', board: '---------', cells: [], lastCell: null, fen: '', turnId: x.id })
  })

  it('ходы чередуются, занятая клетка и чужой ход отклоняются', async () => {
    const { id, x, o } = await start()
    expect((await place(o.token, id, 0)).body).toMatchObject({ error: 'not_your_turn' })
    const first = await place(x.token, id, 4)
    expect(first.status).toBe(200)
    expect(first.body.game).toMatchObject({ board: '----X----', cells: [4], lastCell: 4, turnId: o.id })
    expect((await place(o.token, id, 4)).body).toMatchObject({ error: 'cell_taken' })
    const second = await place(o.token, id, 0)
    expect(second.body.game).toMatchObject({ board: 'O---X----', turnId: x.id })
    expect((await place(x.token, id, 9)).status).toBe(400)
  })

  it('три в ряд заканчивает игру победой', async () => {
    const { id, x, o } = await start()
    for (const [who, cell] of [[x, 0], [o, 3], [x, 1], [o, 4]] as const) await place(who.token, id, cell)
    const win = await place(x.token, id, 2)
    expect(win.body.game).toMatchObject({ status: 'finished', turnId: null, result: { winnerId: x.id, reason: 'line' } })
    expect((await place(o.token, id, 5)).body).toMatchObject({ error: 'not_active' })
  })

  it('полное поле без линии это ничья', async () => {
    const { id, x, o } = await start()
    // X O X / X O O / O X X
    const order: [typeof x, number][] = [[x, 0], [o, 1], [x, 2], [o, 4], [x, 3], [o, 5], [x, 7], [o, 6], [x, 8]]
    let last
    for (const [who, cell] of order) last = await place(who.token, id, cell)
    expect(last!.body.game).toMatchObject({ status: 'finished', result: { winnerId: null, reason: 'draw' } })
  })

  it('сопернику уходит уведомление о ходе и об итоге', async () => {
    const { id, x, o } = await start()
    await resetSent()
    await place(x.token, id, 0)
    const titles = (await sentTo([o === fam.mom ? endpoints.mom : endpoints.dad])).map((p) => p.payload.title)
    expect(titles.some((t) => t.includes('ваш ход'))).toBe(true)
  })

  it('ход шахматного вида в крестики-нолики и наоборот не принимается', async () => {
    const { id, x } = await start()
    const res = await api(app, x.token, 'POST', `/api/games/${id}/move`, { from: 'e2', to: 'e4' })
    expect(res.body).toMatchObject({ error: 'wrong_game' })
  })
})
