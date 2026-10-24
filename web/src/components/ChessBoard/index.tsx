import { useMemo, useState } from 'react'
import { Chess, type Square as ChessSquare } from 'chess.js'
import type { ChessMove } from '@/api'
import { Dot, Frame, Grid, Piece, Square } from './styles'

// Фигуры сплошными символами (с ︎, чтобы браузер не рисовал их цветными эмодзи); цвет фигуры задаёт заливка
const GLYPHS: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const PIECE_NAMES: Record<string, string> = { k: 'король', q: 'ферзь', r: 'ладья', b: 'слон', n: 'конь', p: 'пешка' }

interface ChessBoardProps {
  fen: string
  // с чьей стороны смотрим: свои фигуры внизу
  orientation: 'w' | 'b'
  lastMove: Pick<ChessMove, 'from' | 'to'> | null
  // можно ли сейчас ходить (мой ход, игра идёт, запрос не в полёте)
  canMove: boolean
  onMove: (from: string, to: string) => void
}

// Шахматная доска: нажатие на свою фигуру показывает, куда она может пойти, нажатие на отмеченную клетку делает ход.
// Правила (допустимые ходы, шах) считает chess.js, окончательно ход проверяет сервер.
export function ChessBoard({ fen, orientation, lastMove, canMove, onMove }: ChessBoardProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const chess = useMemo(() => new Chess(fen), [fen])
  const board = chess.board()
  const turn = chess.turn()
  const targets = useMemo(() => {
    if (!selected) return new Set<string>()
    return new Set(chess.moves({ square: selected as ChessSquare, verbose: true }).map((m) => m.to))
  }, [chess, selected])
  const kingInCheck = useMemo(() => {
    if (!chess.isCheck()) return null
    for (const row of chess.board()) for (const cell of row) if (cell && cell.type === 'k' && cell.color === chess.turn()) return cell.square
    return null
  }, [chess])

  // позиция изменилась (ход пришёл с сервера): выбор больше не актуален
  const [shownFen, setShownFen] = useState(fen)
  if (shownFen !== fen) {
    setShownFen(fen)
    setSelected(null)
  }

  const order = orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]

  function press(square: string, color: string | undefined) {
    if (!canMove) return
    if (selected && targets.has(square)) {
      setSelected(null)
      onMove(selected, square)
    } else if (color === orientation && color === turn) {
      setSelected(square === selected ? null : square)
    } else {
      setSelected(null)
    }
  }

  return (
    <Frame>
      <Grid role="grid" aria-label="Шахматная доска">
        {order.flatMap((r) =>
          order.map((f) => {
            const cell = board[r][f]
            const square = `${FILES[f]}${8 - r}`
            const mark = kingInCheck === square ? 'check' : selected === square ? 'selected' : lastMove && (lastMove.from === square || lastMove.to === square) ? 'last' : undefined
            const target = targets.has(square)
            return (
              <Square
                key={square}
                type="button"
                role="gridcell"
                $dark={(r + f) % 2 === 1}
                $mark={mark}
                disabled={!canMove}
                aria-label={`${square}${cell ? `, ${cell.color === 'w' ? 'белая' : 'чёрная'} ${PIECE_NAMES[cell.type]}` : ''}${target ? ', можно сходить' : ''}`}
                onClick={() => press(square, cell?.color)}
              >
                {cell && <Piece $white={cell.color === 'w'}>{`${GLYPHS[cell.type]}︎`}</Piece>}
                {target && <Dot $capture={!!cell} />}
              </Square>
            )
          }),
        )}
      </Grid>
    </Frame>
  )
}
