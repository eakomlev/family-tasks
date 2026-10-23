import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../../src/app.js'
import { pool } from '../../src/db.js'
import { api, createFamily, removeFamilies, type TestFamily } from '../helpers.js'
import { resetSent, sentTo, subscribe } from '../webpush.js'

let app: Awaited<ReturnType<typeof buildApp>>
let fam: TestFamily
let outsider: TestFamily
let endpoints: Record<'mom' | 'dad' | 'kid', string>

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
  fam = await createFamily()
  outsider = await createFamily()
  endpoints = { mom: await subscribe(fam.mom.id), dad: await subscribe(fam.dad.id), kid: await subscribe(fam.kid.id) }
})
beforeEach(async () => {
  await resetSent()
})
afterAll(async () => {
  await removeFamilies(fam.id, outsider.id)
  await app.close()
  await pool.end()
})

const invite = (token: string, opponentId: string) => api(app, token, 'POST', '/api/games', { kind: 'chess', opponentId })
const act = (token: string, id: string, action: string, body?: object) => api(app, token, 'POST', `/api/games/${id}/${action}`, body)
const titles = async (who: keyof typeof endpoints) => (await sentTo([endpoints[who]])).map((p: any) => p.title)

// начатая партия между мамой (пригласила) и папой; возвращает, кто ходит белыми и чёрными
async function startGame() {
  const created = await invite(fam.mom.token, fam.dad.id)
  const game = created.body.game
  const accepted = await act(fam.dad.token, game.id, 'accept')
  const whiteIsMom = accepted.body.game.whiteId === fam.mom.id
  return { id: game.id as string, white: whiteIsMom ? fam.mom : fam.dad, black: whiteIsMom ? fam.dad : fam.mom }
}

describe('приглашение', () => {
  it('создаёт приглашение и уведомляет приглашённого', async () => {
    const res = await invite(fam.mom.token, fam.kid.id)
    expect(res.status).toBe(201)
    expect(res.body.game).toMatchObject({ kind: 'chess', status: 'invited', inviterId: fam.mom.id, inviteeId: fam.kid.id, whiteId: null })
    expect((await titles('kid')).length).toBe(1)
    // повторное приглашение того же человека: уже есть
    const again = await invite(fam.kid.token, fam.mom.id)
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('game_exists')
    await act(fam.mom.token, res.body.game.id, 'cancel')
  })

  it('нельзя пригласить себя, чужого и в неизвестную игру', async () => {
    expect((await invite(fam.mom.token, fam.mom.id)).status).toBe(400)
    expect((await invite(fam.mom.token, outsider.mom.id)).status).toBe(404)
    expect((await api(app, fam.mom.token, 'POST', '/api/games', { kind: 'checkers', opponentId: fam.dad.id })).status).toBe(400)
  })

  it('принять может только приглашённый; цвета назначаются, ход у белых', async () => {
    const res = await invite(fam.mom.token, fam.kid.id)
    const id = res.body.game.id
    expect((await act(fam.mom.token, id, 'accept')).status).toBe(403)
    expect((await act(outsider.mom.token, id, 'accept')).status).toBe(404)
    const accepted = await act(fam.kid.token, id, 'accept')
    expect(accepted.body.game).toMatchObject({ status: 'active' })
    expect(accepted.body.game.turnId).toBe(accepted.body.game.whiteId)
    expect([fam.mom.id, fam.kid.id]).toContain(accepted.body.game.whiteId)
    await act(fam.kid.token, id, 'resign')
  })

  it('отклонение: приглашённый отклоняет, пригласивший получает уведомление, можно пригласить снова', async () => {
    const res = await invite(fam.dad.token, fam.kid.id)
    expect((await act(fam.dad.token, res.body.game.id, 'decline')).status).toBe(403)
    const declined = await act(fam.kid.token, res.body.game.id, 'decline')
    expect(declined.body.game.status).toBe('declined')
    expect(await titles('dad')).toHaveLength(1)
    const next = await invite(fam.dad.token, fam.kid.id)
    expect(next.status).toBe(201)
    expect((await act(fam.dad.token, next.body.game.id, 'cancel')).body.game.status).toBe('cancelled')
  })
})

describe('партия', () => {
  it('ходы по очереди, соперник получает уведомление, список игр', async () => {
    const { id, white, black } = await startGame()
    await resetSent()
    expect((await act(black.token, id, 'move', { from: 'e7', to: 'e5' })).body.error).toBe('not_your_turn')
    const first = await act(white.token, id, 'move', { from: 'e2', to: 'e4' })
    expect(first.status).toBe(200)
    expect(first.body.game).toMatchObject({ turnId: black.id, lastMove: { from: 'e2', to: 'e4', san: 'e4' } })
    const blackEndpoint = black.id === fam.mom.id ? 'mom' : 'dad'
    expect(await titles(blackEndpoint)).toHaveLength(1)

    const list = await api(app, black.token, 'GET', '/api/games')
    expect(list.body.games.map((g: any) => g.id)).toContain(id)
    expect((await api(app, outsider.mom.token, 'GET', `/api/games/${id}`)).status).toBe(404)
    await act(white.token, id, 'resign')
  })

  it('нелегальный ход отклоняется и очередь не меняется', async () => {
    const { id, white } = await startGame()
    const bad = await act(white.token, id, 'move', { from: 'e2', to: 'e5' })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('illegal_move')
    expect((await api(app, white.token, 'GET', `/api/games/${id}`)).body.game.turnId).toBe(white.id)
    await act(white.token, id, 'resign')
  })

  it('мат завершает игру и фиксирует победителя', async () => {
    const { id, white, black } = await startGame()
    await act(white.token, id, 'move', { from: 'f2', to: 'f3' })
    await act(black.token, id, 'move', { from: 'e7', to: 'e5' })
    await act(white.token, id, 'move', { from: 'g2', to: 'g4' })
    const mate = await act(black.token, id, 'move', { from: 'd8', to: 'h4' })
    expect(mate.body.game).toMatchObject({ status: 'finished', turnId: null, result: { winnerId: black.id, reason: 'checkmate' } })
    expect((await act(white.token, id, 'move', { from: 'a2', to: 'a3' })).body.error).toBe('not_active')
  })

  it('сдача заканчивает игру и уведомляет соперника итогом', async () => {
    const { id, white, black } = await startGame()
    await resetSent()
    const res = await act(white.token, id, 'resign')
    expect(res.body.game.result).toEqual({ winnerId: black.id, reason: 'resign' })
    const blackEndpoint = black.id === fam.mom.id ? 'mom' : 'dad'
    expect(await titles(blackEndpoint)).toHaveLength(1)
  })
})
