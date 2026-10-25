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
    expect((await api(app, fam.mom.token, 'POST', '/api/games', { kind: 'battleship', opponentId: fam.dad.id })).status).toBe(400)
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

describe('ничья по соглашению', () => {
  const endpointOf = (who: { id: string }) => (who.id === fam.mom.id ? 'mom' : 'dad')
  const realTitles = async (who: keyof typeof endpoints) => (await sentTo([endpoints[who]])).map((p) => p.payload.title)

  it('предложение, принятие: ничья, игра закончена, предложивший получает итог', async () => {
    const { id, white, black } = await startGame()
    await resetSent()
    const offered = await act(white.token, id, 'draw/offer')
    expect(offered.status).toBe(200)
    expect(offered.body.game.drawOffer).toBe(white.id)
    expect((await realTitles(endpointOf(black))).some((t) => t.includes('предлагает ничью'))).toBe(true)
    // предложивший сам принять не может, повторно предложить тоже
    expect((await act(white.token, id, 'draw/accept')).body.error).toBe('no_offer')
    expect((await act(white.token, id, 'draw/offer')).body.error).toBe('already_offered')
    expect((await act(black.token, id, 'draw/offer')).body.error).toBe('draw_offered')
    await resetSent()
    const accepted = await act(black.token, id, 'draw/accept')
    expect(accepted.body.game).toMatchObject({ status: 'finished', turnId: null, drawOffer: null, result: { winnerId: null, reason: 'agreement' } })
    expect((await titles(endpointOf(white))).length).toBe(1)
    expect((await act(white.token, id, 'move', { from: 'e2', to: 'e4' })).body.error).toBe('not_active')
  })

  it('отказ снимает предложение; ход тоже его снимает; чаще раза за ход предлагать нельзя', async () => {
    const { id, white, black } = await startGame()
    await act(white.token, id, 'draw/offer')
    const declined = await act(black.token, id, 'draw/decline')
    expect(declined.body.game).toMatchObject({ status: 'active', drawOffer: null })
    // в тот же ход снова нельзя
    expect((await act(white.token, id, 'draw/offer')).body.error).toBe('offer_too_soon')
    expect((await act(black.token, id, 'draw/decline')).body.error).toBe('no_offer')
    // после хода можно, а сам ход снимает прежнее предложение
    await act(white.token, id, 'move', { from: 'e2', to: 'e4' })
    expect((await act(black.token, id, 'draw/offer')).body.game.drawOffer).toBe(black.id)
    const moved = await act(black.token, id, 'move', { from: 'e7', to: 'e5' })
    expect(moved.body.game.drawOffer).toBeNull()
    expect((await act(white.token, id, 'draw/accept')).body.error).toBe('no_offer')
    await act(white.token, id, 'resign')
  })

  it('чужая игра, не шахматы, не начатая игра', async () => {
    const { id, white } = await startGame()
    expect((await act(outsider.mom.token, id, 'draw/offer')).status).toBe(404)
    await act(white.token, id, 'resign')
    expect((await act(white.token, id, 'draw/offer')).body.error).toBe('not_active')
    const ttt = await api(app, fam.mom.token, 'POST', '/api/games', { kind: 'tictactoe', opponentId: fam.dad.id })
    await act(fam.dad.token, ttt.body.game.id, 'accept')
    expect((await act(fam.mom.token, ttt.body.game.id, 'draw/offer')).body.error).toBe('wrong_game')
    await act(fam.mom.token, ttt.body.game.id, 'resign')
  })
})

describe('превращение пешки', () => {
  // 1.h4 g5 2.hxg5 h6 3.gxh6 Nf6 4.h7 Rg8 5.hxg8=…
  async function toPromotion() {
    const { id, white, black } = await startGame()
    const steps: [typeof white, string, string][] = [
      [white, 'h2', 'h4'], [black, 'g7', 'g5'], [white, 'h4', 'g5'], [black, 'h7', 'h6'], [white, 'g5', 'h6'],
      [black, 'g8', 'f6'], [white, 'h6', 'h7'], [black, 'h8', 'g8'],
    ]
    for (const [who, from, to] of steps) expect((await act(who.token, id, 'move', { from, to })).status).toBe(200)
    return { id, white }
  }

  it('выбранная фигура ставится на поле, без выбора ферзь', async () => {
    const knight = await toPromotion()
    const res = await act(knight.white.token, knight.id, 'move', { from: 'h7', to: 'g8', promotion: 'n' })
    expect(res.body.game.lastMove).toMatchObject({ from: 'h7', to: 'g8', san: 'hxg8=N', promotion: 'n' })
    await act(knight.white.token, knight.id, 'resign')

    const queen = await toPromotion()
    const def = await act(queen.white.token, queen.id, 'move', { from: 'h7', to: 'g8' })
    expect(def.body.game.lastMove).toMatchObject({ promotion: 'q' })
    await act(queen.white.token, queen.id, 'resign')
  })

  it('недопустимая фигура (король, пешка) отклоняется схемой', async () => {
    const { id, white } = await toPromotion()
    expect((await act(white.token, id, 'move', { from: 'h7', to: 'g8', promotion: 'k' })).status).toBe(400)
    expect((await act(white.token, id, 'move', { from: 'h7', to: 'g8', promotion: 'p' })).status).toBe(400)
    await act(white.token, id, 'resign')
  })
})

describe('счёт', () => {
  const score = async (token: string, opponentId: string, kind = 'chess') => {
    const res = await api(app, token, 'GET', `/api/games/score?opponentId=${opponentId}`)
    expect(res.status).toBe(200)
    return res.body.scores.find((s: { kind: string }) => s.kind === kind) as { wins: number; losses: number; draws: number }
  }

  it('считает победы, поражения и ничьи между двумя участниками, у каждого со своей стороны', async () => {
    const before = await score(fam.mom.token, fam.dad.id)
    const { id, white, black } = await startGame()
    await act(white.token, id, 'resign')
    const mom = await score(fam.mom.token, fam.dad.id)
    const dad = await score(fam.dad.token, fam.mom.id)
    const momWon = black.id === fam.mom.id
    expect(mom.wins - before.wins).toBe(momWon ? 1 : 0)
    expect(mom.losses - before.losses).toBe(momWon ? 0 : 1)
    expect(dad.wins).toBe(mom.losses)
    expect(dad.losses).toBe(mom.wins)

    const second = await startGame()
    await act(second.white.token, second.id, 'draw/offer')
    await act(second.black.token, second.id, 'draw/accept')
    const after = await score(fam.mom.token, fam.dad.id)
    expect(after.draws - mom.draws).toBe(1)
    expect(after.wins).toBe(mom.wins)
  })

  it('незавершённые партии и игры с другими участниками не считаются, остальные игры нули', async () => {
    const withKid = await score(fam.mom.token, fam.kid.id)
    await startGame()
    expect(await score(fam.mom.token, fam.kid.id)).toEqual(withKid)
    expect(await score(fam.mom.token, fam.dad.id, 'checkers')).toEqual({ kind: 'checkers', wins: 0, losses: 0, draws: 0 })
  })

  it('чужой участник и плохой id: пустой счёт и 400', async () => {
    const res = await api(app, fam.mom.token, 'GET', `/api/games/score?opponentId=${outsider.dad.id}`)
    expect(res.body.scores.every((s: { wins: number; losses: number; draws: number }) => s.wins + s.losses + s.draws === 0)).toBe(true)
    expect((await api(app, fam.mom.token, 'GET', '/api/games/score?opponentId=x')).status).toBe(400)
    expect((await api(app, '', 'GET', `/api/games/score?opponentId=${fam.dad.id}`)).status).toBe(401)
  })
})
