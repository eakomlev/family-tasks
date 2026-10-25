import { describe, expect, it } from 'vitest'
import { ApiError, type Game } from '@/api'
import { describeGameError } from '@/lib/errors'
import { gameStatusLine, lastMoveText, needsMyAction, openGames, resultText } from '@/lib/games'
import { parseMessage } from '@/realtime/utils'
import { tagsForEvent } from '@/store/invalidate'

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
    expect(resultText({ winnerId: 'me', reason: 'resign' }, 'me')).toBe('Соперник сдался. Вы победили!')
  })

  it('на «Моём дне» только открытые игры, где ждут меня, выше', () => {
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

  it('понятные тексты ошибок', () => {
    expect(describeGameError(new ApiError(409, 'not_your_turn'))).toBe('Сейчас ход соперника.')
    expect(describeGameError(new ApiError(400, 'illegal_move'))).toBe('Так ходить нельзя.')
    expect(describeGameError(new ApiError(409, 'game_exists'))).toContain('уже идёт')
    expect(describeGameError(new Error('x'))).toBe('Не удалось выполнить действие. Попробуйте ещё раз.')
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
