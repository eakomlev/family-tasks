// Русские шашки: правила на сервере (сервер решает, какие ходы допустимы; клиенты только рисуют доску и отправляют выбранный путь).
//
// Поле — 64 знака по рядам снизу вверх, слева направо: индекс = ряд * 8 + колонка, клетка a1 это индекс 0. Тёмные клетки те, где
// колонка + ряд чётны (a1, c1, b2…). Знаки: «.» пусто, «w» белая шашка, «W» белая дамка, «b» чёрная шашка, «B» чёрная дамка.
// Белые ходят первыми и стоят внизу.
//
// Правила: шашка ходит на одну клетку вперёд по диагонали, бьёт вперёд и назад; дамка ходит и бьёт по диагонали на любое расстояние.
// Бить обязательно (любым способом, большинство не обязательно), удар продолжается, пока есть что бить; шашка, дошедшая до последнего
// ряда в ходе удара, становится дамкой и продолжает бить как дамка. Побитые фигуры снимаются после хода (турецкий удар: одну фигуру
// нельзя бить дважды, а до снятия она мешает проходу).

export type Side = 'w' | 'b'

export const FILES = 'abcdefgh'
export const EMPTY_BOARD_CELL = '.'

// Начальная расстановка: белые на a1…h3 (12 шашек), чёрные на a6…h8
export function startBoard(): string {
  const cells: string[] = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dark = (f + r) % 2 === 0
      cells.push(!dark ? '.' : r < 3 ? 'w' : r > 4 ? 'b' : '.')
    }
  }
  return cells.join('')
}

const DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const inside = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8
const index = (f: number, r: number) => r * 8 + f
export const squareName = (f: number, r: number) => `${FILES[f]}${r + 1}`

export function parseSquare(name: string): { f: number; r: number } | null {
  const m = /^([a-h])([1-8])$/.exec(name)
  return m ? { f: FILES.indexOf(m[1]), r: Number(m[2]) - 1 } : null
}

export const sideOf = (piece: string): Side | null => (piece === 'w' || piece === 'W' ? 'w' : piece === 'b' || piece === 'B' ? 'b' : null)
const isKing = (piece: string) => piece === 'W' || piece === 'B'
const promotionRank = (side: Side) => (side === 'w' ? 7 : 0)

// Продолжения удара из клетки (f, r): полные пути (с уже набранным path), в которых нельзя больше бить. Пусто, если бить нечего.
function captures(board: string[], f: number, r: number, king: boolean, side: Side, taken: Set<number>, path: string[]): string[][] {
  const out: string[][] = []
  for (const [dx, dy] of DIRS) {
    // что бьём и куда можно встать после удара
    let victim = -1
    const landings: [number, number][] = []
    if (king) {
      let nf = f + dx
      let nr = r + dy
      while (inside(nf, nr) && board[index(nf, nr)] === EMPTY_BOARD_CELL) {
        nf += dx
        nr += dy
      }
      if (!inside(nf, nr)) continue
      const at = board[index(nf, nr)]
      if (sideOf(at) === side || sideOf(at) === null || taken.has(index(nf, nr))) continue
      victim = index(nf, nr)
      let lf = nf + dx
      let lr = nr + dy
      while (inside(lf, lr) && board[index(lf, lr)] === EMPTY_BOARD_CELL) {
        landings.push([lf, lr])
        lf += dx
        lr += dy
      }
    } else {
      const nf = f + dx
      const nr = r + dy
      const lf = f + 2 * dx
      const lr = r + 2 * dy
      if (!inside(lf, lr)) continue
      const at = board[index(nf, nr)]
      if (sideOf(at) === null || sideOf(at) === side || taken.has(index(nf, nr)) || board[index(lf, lr)] !== EMPTY_BOARD_CELL) continue
      victim = index(nf, nr)
      landings.push([lf, lr])
    }
    if (landings.length === 0) continue

    const nextTaken = new Set(taken).add(victim)
    const continued = landings.map(([lf, lr]) => {
      // шашка, дошедшая до последнего ряда, дальше бьёт как дамка
      const nowKing = king || lr === promotionRank(side)
      return { land: [lf, lr] as [number, number], tails: captures(board, lf, lr, nowKing, side, nextTaken, [...path, squareName(lf, lr)]) }
    })
    // если с какой-то клетки приземления удар можно продолжить, встать можно только на такие клетки
    const withMore = continued.filter((c) => c.tails.length > 0)
    if (withMore.length > 0) for (const c of withMore) out.push(...c.tails)
    else for (const c of continued) out.push([...path, squareName(c.land[0], c.land[1])])
  }
  return out
}

// Все допустимые ходы стороны: каждый это путь клеток (первая — откуда, дальше куда). Есть удар — допустимы только удары.
export function legalPaths(boardText: string, side: Side): string[][] {
  const board = [...boardText]
  const hits: string[][] = []
  for (let i = 0; i < 64; i++) {
    if (sideOf(board[i]) !== side) continue
    const f = i % 8
    const r = Math.floor(i / 8)
    // сама фигура с места уходит: её клетка при ударе свободна (можно вернуться на неё)
    const copy = [...board]
    copy[i] = EMPTY_BOARD_CELL
    hits.push(...captures(copy, f, r, isKing(board[i]), side, new Set(), [squareName(f, r)]))
  }
  if (hits.length > 0) return hits

  const quiet: string[][] = []
  for (let i = 0; i < 64; i++) {
    const piece = board[i]
    if (sideOf(piece) !== side) continue
    const f = i % 8
    const r = Math.floor(i / 8)
    for (const [dx, dy] of DIRS) {
      if (!isKing(piece) && dy !== (side === 'w' ? 1 : -1)) continue
      let nf = f + dx
      let nr = r + dy
      while (inside(nf, nr) && board[index(nf, nr)] === EMPTY_BOARD_CELL) {
        quiet.push([squareName(f, r), squareName(nf, nr)])
        if (!isKing(piece)) break
        nf += dx
        nr += dy
      }
    }
  }
  return quiet
}

export const samePath = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i])

export interface Applied {
  board: string
  // сколько фигур побито
  captured: number
  // двигалась шашка (не дамка)
  manMoved: boolean
  // запись хода: «c3-d4» или «c3:e5:g7»
  notation: string
}

// Применяет допустимый путь (проверка допустимости на вызывающем): снимает побитое, двигает фигуру, делает дамку.
export function applyPath(boardText: string, path: string[]): Applied {
  const board = [...boardText]
  const start = parseSquare(path[0])!
  const piece = board[index(start.f, start.r)]
  const side = sideOf(piece)!
  let captured = 0
  board[index(start.f, start.r)] = EMPTY_BOARD_CELL
  let promoted = false
  let prev = start
  for (const name of path.slice(1)) {
    const to = parseSquare(name)!
    const dx = Math.sign(to.f - prev.f)
    const dy = Math.sign(to.r - prev.r)
    // между клетками удара стоит ровно одна чужая фигура
    for (let f = prev.f + dx, r = prev.r + dy; f !== to.f; f += dx, r += dy) {
      if (board[index(f, r)] !== EMPTY_BOARD_CELL) {
        board[index(f, r)] = EMPTY_BOARD_CELL
        captured++
      }
    }
    if (!isKing(piece) && to.r === promotionRank(side)) promoted = true
    prev = to
  }
  board[index(prev.f, prev.r)] = isKing(piece) || promoted ? piece.toUpperCase() : piece
  const sep = captured > 0 ? ':' : '-'
  return { board: board.join(''), captured, manMoved: !isKing(piece), notation: path.join(sep) }
}

export const sideToMove = (whiteId: string | null, turnId: string | null): Side | null => (turnId === null || whiteId === null ? null : turnId === whiteId ? 'w' : 'b')

// 15 ходов каждой стороны одними дамками без боя: ничья
export const QUIET_DRAW_PLIES = 30
