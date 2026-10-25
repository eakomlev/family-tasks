import { describe, expect, it } from 'vitest'
import { applyPath, legalPaths, parseSquare, startBoard } from '../../src/checkers.js'

// Поле из расстановки вида { c3: 'w', d4: 'b' }; всё остальное пусто
function boardOf(pieces: Record<string, string>): string {
  const cells = Array(64).fill('.')
  for (const [name, piece] of Object.entries(pieces)) {
    const { f, r } = parseSquare(name)!
    cells[r * 8 + f] = piece
  }
  return cells.join('')
}
const count = (board: string, piece: string) => [...board].filter((c) => c === piece).length
const keys = (paths: string[][]) => paths.map((p) => p.join('>')).sort()

describe('шашки: начало партии', () => {
  it('по 12 шашек, у каждой стороны по 7 ходов, бить нечего', () => {
    const board = startBoard()
    expect(count(board, 'w')).toBe(12)
    expect(count(board, 'b')).toBe(12)
    const white = legalPaths(board, 'w')
    expect(white).toHaveLength(7)
    expect(white.every((p) => p.length === 2)).toBe(true)
    expect(legalPaths(board, 'b')).toHaveLength(7)
    // шашки стоят на тёмных клетках: a1, c1, b2…
    expect(board[0]).toBe('w')
    expect(board[1]).toBe('.')
    expect(parseSquare('b2')).toEqual({ f: 1, r: 1 })
  })

  it('шашка ходит только вперёд, на одну клетку', () => {
    expect(keys(legalPaths(boardOf({ d4: 'w' }), 'w'))).toEqual(['d4>c5', 'd4>e5'])
    expect(keys(legalPaths(boardOf({ d4: 'b' }), 'b'))).toEqual(['d4>c3', 'd4>e3'])
  })
})

describe('шашки: бой', () => {
  it('бить обязательно: простые ходы недоступны, пока есть удар', () => {
    const board = boardOf({ c3: 'w', d4: 'b', a1: 'w' })
    expect(keys(legalPaths(board, 'w'))).toEqual(['c3>e5'])
  })

  it('шашка бьёт и назад', () => {
    expect(keys(legalPaths(boardOf({ e5: 'w', d4: 'b' }), 'w'))).toEqual(['e5>c3'])
  })

  it('удар нельзя остановить на полпути: путь через все возможные взятия', () => {
    const paths = legalPaths(boardOf({ c3: 'w', d4: 'b', f6: 'b' }), 'w')
    expect(keys(paths)).toEqual(['c3>e5>g7'])
  })

  it('занятая клетка за фигурой не даёт её бить', () => {
    expect(keys(legalPaths(boardOf({ c3: 'w', d4: 'b', e5: 'b' }), 'w'))).toEqual(['c3>b4'])
  })

  it('своих бить нельзя', () => {
    expect(keys(legalPaths(boardOf({ c3: 'w', d4: 'w' }), 'w'))).toEqual(['c3>b4', 'd4>c5', 'd4>e5'])
  })

  it('шашка, дошедшая до последнего ряда в ходе удара, дальше бьёт как дамка', () => {
    // c6 бьёт d7 и становится дамкой на e8, откуда достаёт далёкую шашку g6 (шашка до неё бы не дотянулась)
    const paths = legalPaths(boardOf({ c6: 'w', d7: 'b', g6: 'b' }), 'w')
    expect(keys(paths)).toEqual(['c6>e8>h5'])
  })
})

describe('шашки: дамка', () => {
  it('ходит по диагонали на любое число клеток', () => {
    const paths = legalPaths(boardOf({ a1: 'W' }), 'w')
    expect(keys(paths)).toEqual(['a1>b2', 'a1>c3', 'a1>d4', 'a1>e5', 'a1>f6', 'a1>g7', 'a1>h8'].sort())
  })

  it('бьёт издалека и может встать на любую свободную клетку за фигурой', () => {
    const paths = legalPaths(boardOf({ a1: 'W', d4: 'b' }), 'w')
    expect(keys(paths)).toEqual(['a1>e5', 'a1>f6', 'a1>g7', 'a1>h8'])
  })

  it('если с какой-то клетки удар можно продолжить, вставать нужно на такую', () => {
    // после d4 с e5 можно бить f4 (на g3), с остальных клеток нельзя
    const paths = legalPaths(boardOf({ a1: 'W', d4: 'b', f4: 'b' }), 'w')
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((p) => p[1] === 'e5' && p.length === 3)).toBe(true)
  })

  it('побитая в этом ходу фигура не бьётся дважды и мешает проходу (турецкий удар)', () => {
    // дамка a1 бьёт d4, встаёт за ней; назад через ту же фигуру вернуться нельзя
    const paths = legalPaths(boardOf({ a1: 'W', d4: 'b' }), 'w')
    expect(paths.every((p) => p.length === 2)).toBe(true)
  })

  it('черная сторона ходит и бьёт зеркально', () => {
    expect(keys(legalPaths(boardOf({ f6: 'b', e5: 'w' }), 'b'))).toEqual(['f6>d4'])
  })
})

describe('шашки: применение хода', () => {
  it('простой ход и запись', () => {
    const result = applyPath(boardOf({ c3: 'w' }), ['c3', 'd4'])
    expect(result).toMatchObject({ captured: 0, manMoved: true, notation: 'c3-d4' })
    expect(result.board).toBe(boardOf({ d4: 'w' }))
  })

  it('удар снимает побитые, запись через двоеточие', () => {
    const result = applyPath(boardOf({ c3: 'w', d4: 'b', f6: 'b', a1: 'w' }), ['c3', 'e5', 'g7'])
    expect(result).toMatchObject({ captured: 2, notation: 'c3:e5:g7' })
    expect(result.board).toBe(boardOf({ g7: 'w', a1: 'w' }))
  })

  it('шашка на последнем ряду становится дамкой, при ударе тоже', () => {
    expect(applyPath(boardOf({ b7: 'w' }), ['b7', 'a8']).board).toBe(boardOf({ a8: 'W' }))
    expect(applyPath(boardOf({ c6: 'w', d7: 'b', g6: 'b' }), ['c6', 'e8', 'h5']).board).toBe(boardOf({ h5: 'W' }))
  })

  it('ход дамкой не считается ходом шашки', () => {
    expect(applyPath(boardOf({ a1: 'W' }), ['a1', 'd4']).manMoved).toBe(false)
  })
})

describe('шашки: конец', () => {
  it('нет фигур или ходы заперты: ходов нет', () => {
    expect(legalPaths(boardOf({ a1: 'w' }), 'b')).toEqual([])
    // белая шашка в углу заперта своей: b2 занята, бить некого
    expect(legalPaths(boardOf({ a1: 'w', b2: 'w', c3: 'w', a3: 'w' }), 'w').some((p) => p[0] === 'a1')).toBe(false)
  })
})
