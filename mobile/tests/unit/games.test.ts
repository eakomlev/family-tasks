import { describe, expect, it } from 'vitest'
import type { Game } from '../../src/api'
import { GAMES, gameStatusLine, lastMoveText, needsMyAction, openGames, resultText, scoreLine } from '../../src/features/games/utils'
import { winningLine } from '../../src/features/games/ticTacToe'
import { parseMessage } from '../../src/realtime/utils'
import { tagsForEvent } from '../../src/store/invalidate'

const game = (patch: Partial<Game>): Game => ({
  id: 'g1',
  kind: 'chess',
  status: 'active',
  inviterId: 'me',
  inviteeId: 'other',
  whiteId: 'me',
  turnId: 'me',
  fen: 'start',
  moves: [],
  lastMove: null,
  board: null,
  cells: [],
  lastCell: null,
  result: null,
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T10:00:00Z',
  ...patch,
})

describe('игры', () => {
  it('строка состояния по статусу и очереди', () => {
    expect(gameStatusLine(game({ status: 'invited', turnId: null }), 'me')).toBe('Ждём ответа')
    expect(gameStatusLine(game({ status: 'invited', turnId: null }), 'other')).toBe('Приглашает вас сыграть')
    expect(gameStatusLine(game({}), 'me')).toBe('Ваш ход')
    expect(gameStatusLine(game({ turnId: 'other' }), 'me')).toBe('Ход соперника')
  })

  it('итог глазами участника', () => {
    expect(resultText({ winnerId: 'me', reason: 'checkmate' }, 'me')).toBe('Мат. Вы победили!')
    expect(resultText({ winnerId: 'other', reason: 'checkmate' }, 'me')).toBe('Мат. Вы проиграли')
    expect(resultText({ winnerId: null, reason: 'stalemate' }, 'me')).toBe('Пат. Ничья')
    expect(resultText({ winnerId: 'other', reason: 'resign' }, 'me')).toBe('Вы сдались')
  })

  it('в «Моём дне» только открытые игры, где ждут меня, выше', () => {
    const waiting = game({ id: 'a', turnId: 'other' })
    const mine = game({ id: 'b' })
    const done = game({ id: 'c', status: 'finished', turnId: null })
    const invited = game({ id: 'd', status: 'invited', turnId: null, inviterId: 'other', inviteeId: 'me' })
    expect(needsMyAction(invited, 'me')).toBe(true)
    expect(openGames([waiting, done, mine, invited], 'me').map((g) => g.id)).toEqual(['b', 'd', 'a'])
  })

  it('последний ход называет сторону', () => {
    expect(lastMoveText(game({}))).toBeNull()
    expect(lastMoveText(game({ moves: [{ from: 'e2', to: 'e4', san: 'e4' }], lastMove: { from: 'e2', to: 'e4', san: 'e4' } }))).toBe('Последний ход белых: e4')
  })

  it('сигнал сокета games сбрасывает кэш игр', () => {
    expect(parseMessage('{"type":"games"}')).toEqual({ type: 'games' })
    expect(tagsForEvent({ type: 'games' })).toEqual(['Games'])
  })
})

describe('крестики-нолики', () => {
  it('итог тремя в ряд глазами каждого', () => {
    expect(resultText({ winnerId: 'me', reason: 'line' }, 'me')).toBe('Три в ряд. Вы победили!')
    expect(resultText({ winnerId: 'other', reason: 'line' }, 'me')).toBe('Соперник собрал три в ряд. Вы проиграли')
  })

  it('выигравшая линия по полю', () => {
    expect(winningLine('XXXOO----')).toEqual([0, 1, 2])
    expect(winningLine('XOXXOOOXX')).toBeNull()
  })

  it('шахматного «последнего хода» у крестиков-ноликов нет', () => {
    expect(lastMoveText(game({ kind: 'tictactoe', lastCell: 4, lastMove: null }))).toBeNull()
  })
})

describe('ничья по соглашению', () => {
  it('итог и строка состояния', () => {
    expect(resultText({ winnerId: null, reason: 'agreement' }, 'me')).toBe('Ничья по соглашению')
    expect(gameStatusLine(game({ drawOffer: 'other' }), 'me')).toBe('Предлагает ничью')
    expect(gameStatusLine(game({ drawOffer: 'me' }), 'me')).toBe('Вы предложили ничью')
  })

  it('предложение соперника это действие, ожидающее меня, даже когда ход не мой', () => {
    expect(needsMyAction(game({ turnId: 'other', drawOffer: 'other' }), 'me')).toBe(true)
    expect(needsMyAction(game({ turnId: 'other', drawOffer: 'me' }), 'me')).toBe(false)
    expect(needsMyAction(game({ turnId: 'other' }), 'me')).toBe(false)
  })
})

describe('шашки', () => {
  it('«нет ходов» словами, шашки в списке доступных игр', () => {
    expect(resultText({ winnerId: 'me', reason: 'no_moves' }, 'me')).toBe('У соперника не осталось ходов. Вы победили!')
    expect(resultText({ winnerId: 'other', reason: 'no_moves' }, 'me')).toBe('У вас не осталось ходов. Вы проиграли')
    expect(GAMES.find((g) => g.kind === 'checkers')?.available).toBe(true)
    expect(GAMES.find((g) => g.kind === 'battleship')?.available).toBe(false)
  })

  it('последний ход путём клеток', () => {
    expect(lastMoveText(game({ kind: 'checkers', lastPath: ['c3', 'e5', 'g7'] }))).toBe('Последний ход: c3 → e5 → g7')
    expect(lastMoveText(game({ kind: 'checkers', lastPath: null }))).toBeNull()
  })
})

describe('scoreLine', () => {
  it('без партий строки нет', () => {
    expect(scoreLine(undefined)).toBeNull()
    expect(scoreLine({ kind: 'chess', wins: 0, losses: 0, draws: 0 })).toBeNull()
  })

  it('показывает победы, поражения и ничьи', () => {
    expect(scoreLine({ kind: 'chess', wins: 3, losses: 1, draws: 2 })).toBe('Побед: 3 · Поражений: 1 · Ничьих: 2')
    expect(scoreLine({ kind: 'chess', wins: 0, losses: 1, draws: 0 })).toBe('Побед: 0 · Поражений: 1 · Ничьих: 0')
  })
})
