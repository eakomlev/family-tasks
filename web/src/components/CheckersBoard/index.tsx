import { useMemo, useState } from 'react'
import { Cell, Frame, Grid, Man, Mark } from './styles'

const FILES = 'abcdefgh'

interface Props {
  // 64 знака: ряды снизу вверх, внутри ряда слева направо; «.» пусто, w/W белая шашка/дамка, b/B чёрная (клетка a1 это знак 0)
  board: string
  // допустимые сейчас ходы того, чей ход (путь клеток: откуда, дальше куда; при ударе все остановки): их считает сервер
  legal: string[][]
  // последний ход путём клеток (подсвечивается)
  lastPath: string[] | null
  // с чьей стороны смотрим: свои шашки внизу
  orientation: 'w' | 'b'
  // можно ли сейчас ходить (мой ход, игра идёт, запрос не в полёте)
  canMove: boolean
  onPlay: (path: string[]) => void
}

const startsWith = (path: string[], prefix: string[]) => prefix.every((s, i) => path[i] === s)

// Доска русских шашек. Правил здесь нет: нажатие на шашку, у которой есть допустимый ход, показывает, куда она может пойти; удар в несколько
// прыжков набирается по клеткам, и когда набранный путь совпал с допустимым ходом целиком, он отправляется.
export function CheckersBoard({ board, legal, lastPath, orientation, canMove, onPlay }: Props) {
  const [prefix, setPrefix] = useState<string[]>([])

  // позиция изменилась (ход пришёл с сервера): набранный путь больше не актуален
  const [shownBoard, setShownBoard] = useState(board)
  if (shownBoard !== board) {
    setShownBoard(board)
    setPrefix([])
  }

  const starts = useMemo(() => new Set(canMove ? legal.map((p) => p[0]) : []), [legal, canMove])
  const next = useMemo(() => {
    if (prefix.length === 0) return new Set<string>()
    return new Set(legal.filter((p) => p.length > prefix.length && startsWith(p, prefix)).map((p) => p[prefix.length]))
  }, [legal, prefix])

  const order = orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const columns = orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]

  function press(square: string) {
    if (!canMove) return
    if (prefix.length === 0) {
      if (starts.has(square)) setPrefix([square])
      return
    }
    if (next.has(square)) {
      const extended = [...prefix, square]
      // набранный путь совпал с допустимым ходом целиком: ход готов
      if (legal.some((p) => p.length === extended.length && startsWith(p, extended))) {
        setPrefix([])
        onPlay(extended)
      } else setPrefix(extended)
      return
    }
    // нажатие на ту же шашку снимает выбор, на другую свою переносит его
    setPrefix(starts.has(square) && square !== prefix[0] && prefix.length === 1 ? [square] : [])
  }

  return (
    <Frame>
      <Grid role="grid" aria-label="Шашечная доска">
        {order.flatMap((r) =>
          columns.map((f) => {
            const square = `${FILES[f]}${r + 1}`
            const piece = board[r * 8 + f]
            const dark = (f + r) % 2 === 0
            const inPath = prefix.includes(square)
            const mark = inPath ? 'selected' : lastPath?.includes(square) ? 'last' : undefined
            const target = next.has(square)
            return (
              <Cell
                key={square}
                type="button"
                role="gridcell"
                $dark={dark}
                $mark={mark}
                disabled={!canMove || !dark}
                aria-label={`${square}${piece !== '.' ? `, ${piece === 'w' || piece === 'W' ? 'белая' : 'чёрная'} ${piece === 'W' || piece === 'B' ? 'дамка' : 'шашка'}` : ''}${target ? ', можно сходить' : ''}`}
                onClick={() => press(square)}
              >
                {piece !== '.' && (
                  <Man $white={piece === 'w' || piece === 'W'} $movable={starts.has(square)}>
                    {(piece === 'W' || piece === 'B') && <span aria-hidden>♛︎</span>}
                  </Man>
                )}
                {target && <Mark />}
              </Cell>
            )
          }),
        )}
      </Grid>
    </Frame>
  )
}
