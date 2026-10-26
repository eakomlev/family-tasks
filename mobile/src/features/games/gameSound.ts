import { Chess } from 'chess.js'
import type { Game } from '@/api'
import { getKv } from '@/lib/kv'

// Звук в игре: ход, взятие, шах, конец партии. Какой звук играть решает `soundForUpdate` по двум последним состояниям игры
// (копия логики из web/src/lib/gameSound.ts, при изменении правьте оба места), играет `playGameSound` (lib/sound.ts). Выключается в «Настройках».
export type GameSound = 'move' | 'capture' | 'check' | 'end'

const KEY = 'gameSound'

export const isGameSoundOn = (): boolean => getKv().getItem(KEY) !== '0'

export function setGameSoundOn(on: boolean): void {
  if (on) getKv().removeItem(KEY)
  else getKv().setItem(KEY, '0')
}

// сколько фигур на доске по строке расстановки из FEN или по полю шашек
const pieces = (placement: string) => placement.replace(/[^a-zA-Z]/g, '').length

// Какой звук сопровождает переход игры из состояния prev в next. Первое состояние (открыли экран) и чужая игра звука не дают.
export function soundForUpdate(prev: Game | undefined, next: Game): GameSound | null {
  if (!prev || prev.id !== next.id) return null
  if (prev.status === 'active' && next.status === 'finished') return 'end'
  if (next.status !== 'active') return null

  if (next.kind === 'chess') {
    if (prev.fen === next.fen) return null
    if (pieces(next.fen.split(' ')[0]) < pieces(prev.fen.split(' ')[0])) return 'capture'
    try {
      if (new Chess(next.fen).isCheck()) return 'check'
    } catch {
      /* непонятная позиция: просто ход */
    }
    return 'move'
  }
  if (!prev.board || !next.board || prev.board === next.board) return null
  // шашки: на поле только буквы фигур, у крестиков-ноликов «X»/«O» (взятий нет)
  if (next.kind === 'checkers' && pieces(next.board) < pieces(prev.board)) return 'capture'
  return 'move'
}
