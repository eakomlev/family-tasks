import { describe, expect, it } from 'vitest'
import type { Game } from '../../src/api'
import { gameStatusLine, lastMoveText, needsMyAction, openGames, resultText } from '../../src/features/games/utils'
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
