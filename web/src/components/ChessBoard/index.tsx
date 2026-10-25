import { useMemo, useState } from 'react'
import { Chess, type Square as ChessSquare } from 'chess.js'
import type { ChessMove, PromotionPiece } from '@/api'
import { Dot, Frame, Grid, Piece, PromoButton, PromoChoices, PromoOverlay, Square } from './styles'

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
  // promotion только у превращения пешки (выбранная человеком фигура)
  onMove: (from: string, to: string, promotion?: PromotionPiece) => void
}

const PROMOTION_CHOICES: { piece: PromotionPiece; name: string }[] = [
  { piece: 'q', name: 'ферзь' },
  { piece: 'r', name: 'ладья' },
  { piece: 'b', name: 'слон' },
  { piece: 'n', name: 'конь' },
]

// Шахматная доска: нажатие на свою фигуру показывает, куда она может пойти, нажатие на отмеченную клетку делает ход.
// Правила (допустимые ходы, шах) считает chess.js, окончательно ход проверяет сервер.
export function ChessBoard({ fen, orientation, lastMove, canMove, onMove }: ChessBoardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  // пешка дошла до края: ждём, во что её превратить
  const [promoting, setPromoting] = useState<{ from: string; to: string } | null>(null)

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
    setPromoting(null)
  }

  const order = orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]

  function press(square: string, color: string | undefined) {
    if (!canMove) return
    if (promoting) return
    if (selected && targets.has(square)) {
      const isPromotion = chess.moves({ square: selected as ChessSquare, verbose: true }).some((m) => m.to === square && m.promotion)
      setSelected(null)
      if (isPromotion) setPromoting({ from: selected, to: square })
      else onMove(selected, square)
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
      {promoting && (
        <PromoOverlay role="dialog" aria-label="Во что превратить пешку?" onClick={() => setPromoting(null)}>
          <PromoChoices onClick={(e) => e.stopPropagation()}>
            {PROMOTION_CHOICES.map(({ piece, name }) => (
              <PromoButton
                key={piece}
                type="button"
                aria-label={name}
                onClick={() => {
                  onMove(promoting.from, promoting.to, piece)
                  setPromoting(null)
                }}
              >
                <Piece $white={orientation === 'w'}>{`${GLYPHS[piece]}︎`}</Piece>
              </PromoButton>
            ))}
          </PromoChoices>
        </PromoOverlay>
      )}
    </Frame>
  )
}
