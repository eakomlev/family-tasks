import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../../src/app.js'
import { parseSquare } from '../../src/checkers.js'
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

const play = (token: string, id: string, path: string[]) => api(app, token, 'POST', `/api/games/${id}/play`, { path })

// начатая партия: мама пригласила, папа принял; белые (ходят первыми) выбираются случайно
async function start() {
  const created = await api(app, fam.mom.token, 'POST', '/api/games', { kind: 'checkers', opponentId: fam.dad.id })
  expect(created.status).toBe(201)
  const id = created.body.game.id as string
  const accepted = await api(app, fam.dad.token, 'POST', `/api/games/${id}/accept`)
  const momWhite = accepted.body.game.whiteId === fam.mom.id
  return { id, white: momWhite ? fam.mom : fam.dad, black: momWhite ? fam.dad : fam.mom, game: accepted.body.game }
}

// Ставит позицию напрямую: расстановка вида { c3: 'w' }, ход белых или чёрных, счётчик тихих ходов
async function setPosition(id: string, pieces: Record<string, string>, turn: 'white' | 'black', quiet = 0) {
  const cells = Array(64).fill('.')
  for (const [name, piece] of Object.entries(pieces)) {
    const { f, r } = parseSquare(name)!
    cells[r * 8 + f] = piece
  }
  const { rows } = await pool.query<{ white_id: string; inviter_id: string; invitee_id: string }>('select white_id, inviter_id, invitee_id from games where id = $1', [id])
  const white = rows[0].white_id
  const black = white === rows[0].inviter_id ? rows[0].invitee_id : rows[0].inviter_id
  await pool.query('update games set state = $2, turn_id = $3 where id = $1', [id, JSON.stringify({ board: cells.join(''), history: [], quiet }), turn === 'white' ? white : black])
}

describe('шашки: партия', () => {
  it('приглашение: начальное поле, у того, чей ход, 7 допустимых ходов; сопернику уведомление', async () => {
    const { game, white } = await start()
    expect(game).toMatchObject({ kind: 'checkers', status: 'active', turnId: white.id, fen: '', lastPath: null, drawOffer: null })
    expect(game.board).toHaveLength(64)
    expect(game.legal).toHaveLength(7)
  })

  it('ход по допустимому пути: поле меняется, очередь переходит, у соперника свои допустимые ходы, ему идёт уведомление', async () => {
    const { id, white, black } = await start()
    await resetSent()
    const res = await play(white.token, id, ['c3', 'd4'])
    expect(res.status).toBe(200)
    expect(res.body.game).toMatchObject({ turnId: black.id, lastPath: ['c3', 'd4'] })
    expect(res.body.game.board[3 * 8 + 3]).toBe('w')
    expect(res.body.game.board[2 * 8 + 2]).toBe('.')
    expect(res.body.game.legal).toHaveLength(7)
    await new Promise((r) => setTimeout(r, 500))
    const titles = (await sentTo([black.id === fam.mom.id ? endpoints.mom : endpoints.dad])).map((p) => p.payload.title)
    expect(titles.some((t) => t.includes('ваш ход'))).toBe(true)
  })

  it('чужая очередь, недопустимый путь, чужие фигуры и не тот вид игры', async () => {
    const { id, white, black } = await start()
    expect((await play(black.token, id, ['b6', 'a5'])).body.error).toBe('not_your_turn')
    expect((await play(white.token, id, ['c3', 'e5'])).body.error).toBe('illegal_move')
    expect((await play(white.token, id, ['a7', 'b6'])).body.error).toBe('illegal_move')
    // путь не из клеток доски отклоняет схема
    expect((await play(white.token, id, ['c3', 'z9'])).status).toBe(400)
    expect((await play(white.token, id, ['c3'])).status).toBe(400)
    expect((await api(app, white.token, 'POST', `/api/games/${id}/move`, { from: 'e2', to: 'e4' })).body.error).toBe('wrong_game')
    expect((await api(app, white.token, 'POST', `/api/games/${id}/place`, { cell: 1 })).body.error).toBe('wrong_game')
  })

  it('чужая семья игру не видит', async () => {
    const { id, white } = await start()
    const other = await createFamily()
    try {
      expect((await play(other.mom.token, id, ['c3', 'd4'])).status).toBe(404)
    } finally {
      await removeFamilies(other.id)
    }
    expect((await api(app, white.token, 'GET', `/api/games/${id}`)).status).toBe(200)
  })

  it('удар обязателен: другие ходы отклоняются, удар через несколько фигур принимается только целиком', async () => {
    const { id, white } = await start()
    await setPosition(id, { c3: 'w', d4: 'b', f6: 'b', a1: 'w', h8: 'b' }, 'white')
    expect((await play(white.token, id, ['a1', 'b2'])).body.error).toBe('illegal_move')
    expect((await play(white.token, id, ['c3', 'e5'])).body.error).toBe('illegal_move')
    const res = await play(white.token, id, ['c3', 'e5', 'g7'])
    expect(res.status).toBe(200)
    expect(res.body.game.board.split('').filter((c: string) => c === 'b')).toHaveLength(1)
    expect(res.body.game.lastPath).toEqual(['c3', 'e5', 'g7'])
  })

  it('побита последняя фигура: у соперника нет ходов, он проиграл', async () => {
    const { id, white } = await start()
    await setPosition(id, { c3: 'w', d4: 'b' }, 'white')
    await resetSent()
    const res = await play(white.token, id, ['c3', 'e5'])
    expect(res.body.game).toMatchObject({ status: 'finished', turnId: null, legal: [], result: { winnerId: white.id, reason: 'no_moves' } })
    expect((await play(white.token, id, ['e5', 'f6'])).body.error).toBe('not_active')
  })

  it('шашка, дошедшая до последнего ряда, становится дамкой', async () => {
    const { id, white } = await start()
    await setPosition(id, { b7: 'w', h2: 'b' }, 'white')
    const res = await play(white.token, id, ['b7', 'a8'])
    expect(res.body.game.board[7 * 8 + 0]).toBe('W')
  })

  it('15 ходов дамками без боя: ничья', async () => {
    const { id, white } = await start()
    await setPosition(id, { a1: 'W', h8: 'B', c7: 'b' }, 'white', 29)
    // ход дамкой: 30-й тихий полуход
    const res = await play(white.token, id, ['a1', 'b2'])
    expect(res.body.game).toMatchObject({ status: 'finished', result: { winnerId: null, reason: 'draw' } })
  })

  it('ход шашкой сбрасывает счётчик тихих ходов', async () => {
    const { id, white } = await start()
    await setPosition(id, { a1: 'W', h8: 'B', c3: 'w', f6: 'b' }, 'white', 29)
    const res = await play(white.token, id, ['c3', 'd4'])
    expect(res.body.game.status).toBe('active')
  })
})

describe('шашки: ничья по соглашению и сдача', () => {
  it('предложить и принять', async () => {
    const { id, white, black } = await start()
    expect((await api(app, white.token, 'POST', `/api/games/${id}/draw/offer`)).body.game.drawOffer).toBe(white.id)
    const accepted = await api(app, black.token, 'POST', `/api/games/${id}/draw/accept`)
    expect(accepted.body.game).toMatchObject({ status: 'finished', result: { winnerId: null, reason: 'agreement' } })
  })

  it('ход снимает предложение, раз за ход', async () => {
    const { id, white, black } = await start()
    await api(app, white.token, 'POST', `/api/games/${id}/draw/offer`)
    expect((await api(app, white.token, 'POST', `/api/games/${id}/draw/offer`)).body.error).toBe('already_offered')
    const moved = await play(white.token, id, ['c3', 'd4'])
    expect(moved.body.game.drawOffer).toBeNull()
    expect((await api(app, black.token, 'POST', `/api/games/${id}/draw/offer`)).status).toBe(200)
  })

  it('сдаться можно, победа у соперника', async () => {
    const { id, white, black } = await start()
    const res = await api(app, white.token, 'POST', `/api/games/${id}/resign`)
    expect(res.body.game.result).toEqual({ winnerId: black.id, reason: 'resign' })
  })
})
