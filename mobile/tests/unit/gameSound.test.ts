import { describe, expect, it } from 'vitest'
import type { Game } from '@/api'
import { isGameSoundOn, setGameSoundOn, soundForUpdate } from '@/features/games/gameSound'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const game = (patch: Partial<Game>): Game => ({
  id: 'g1',
  kind: 'chess',
  status: 'active',
  inviterId: 'me',
  inviteeId: 'other',
  whiteId: 'me',
  turnId: 'me',
  fen: START,
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

// поле шашек из расстановки вида { c3: 'w' }: 64 знака, ряды снизу вверх
const FILES = 'abcdefgh'
const checkersBoard = (pieces: Record<string, string>) => {
  const cells = Array(64).fill('.')
  for (const [name, piece] of Object.entries(pieces)) cells[(Number(name[1]) - 1) * 8 + FILES.indexOf(name[0])] = piece
  return cells.join('')
}

describe('звук игры', () => {
  it('звук включён по умолчанию, выключение запоминается', () => {
    expect(isGameSoundOn()).toBe(true)
    setGameSoundOn(false)
    expect(isGameSoundOn()).toBe(false)
    setGameSoundOn(true)
    expect(isGameSoundOn()).toBe(true)
  })

  it('первое состояние, то же состояние и чужая игра не звучат', () => {
    expect(soundForUpdate(undefined, game({}))).toBeNull()
    expect(soundForUpdate(game({}), game({ updatedAt: '2026-10-24T10:05:00Z' }))).toBeNull()
    expect(soundForUpdate(game({ id: 'g1' }), game({ id: 'g2', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' }))).toBeNull()
  })

  it('шахматы: обычный ход, взятие, шах', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    expect(soundForUpdate(game({}), game({ fen: afterE4 }))).toBe('move')

    // белая пешка берёт чёрную: фигур стало меньше
    const before = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const afterCapture = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'
    expect(soundForUpdate(game({ fen: before }), game({ fen: afterCapture }))).toBe('capture')

    // ладья даёт шах чёрному королю по открытой линии
    const quiet = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1'
    const check = '4k3/8/8/8/8/8/8/4RK2 b - - 1 1'
    expect(soundForUpdate(game({ fen: quiet }), game({ fen: check }))).toBe('check')
  })

  it('конец партии звучит один раз при переходе из «идёт» в «закончена»: мат, сдача и ничья', () => {
    const done = game({ status: 'finished', turnId: null, result: { winnerId: 'me', reason: 'resign' } })
    expect(soundForUpdate(game({}), done)).toBe('end')
    // страницу открыли на уже законченной партии
    expect(soundForUpdate(done, done)).toBeNull()
    // ход, закончивший партию, звучит только как конец
    expect(soundForUpdate(game({}), game({ status: 'finished', turnId: null, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' }))).toBe('end')
  })

  it('приглашение и принятие без звука', () => {
    expect(soundForUpdate(game({ status: 'invited', turnId: null }), game({ status: 'active' }))).toBeNull()
    expect(soundForUpdate(game({ status: 'invited', turnId: null }), game({ status: 'declined', turnId: null }))).toBeNull()
  })

  it('шашки: ход и взятие', () => {
    const base = { kind: 'checkers' as const, fen: '' }
    const before = game({ ...base, board: checkersBoard({ c3: 'w', d4: 'b' }) })
    expect(soundForUpdate(before, game({ ...base, board: checkersBoard({ b4: 'w', d4: 'b' }) }))).toBe('move')
    // белая шашка бьёт чёрную и становится на e5: чёрных не осталось
    expect(soundForUpdate(before, game({ ...base, board: checkersBoard({ e5: 'w' }) }))).toBe('capture')
  })

  it('крестики-нолики: каждый ход звучит как ход', () => {
    const base = { kind: 'tictactoe' as const, fen: '' }
    expect(soundForUpdate(game({ ...base, board: '---------' }), game({ ...base, board: '----X----' }))).toBe('move')
    expect(soundForUpdate(game({ ...base, board: '----X----' }), game({ ...base, board: '---OX----' }))).toBe('move')
  })
})
