import { winningLine } from '@/lib/ticTacToe'
import { Cell, Frame, Grid, Mark } from './styles'

interface Props {
  // 9 знаков по строкам: «X», «O» или «-»
  board: string
  lastCell: number | null
  // можно ли сейчас ходить (мой ход, игра идёт, запрос не в полёте)
  canMove: boolean
  onPlace: (cell: number) => void
}

const NAMES: Record<string, string> = { X: 'крестик', O: 'нолик', '-': 'пусто' }

// Поле 3×3: нажатие на пустую клетку делает ход. Последний ход и выигравшая линия подсвечены.
export function TicTacToeBoard({ board, lastCell, canMove, onPlace }: Props) {
  const line = winningLine(board)
  return (
    <Frame>
      <Grid role="grid" aria-label="Поле крестиков-ноликов">
        {Array.from(board).map((mark, i) => (
          <Cell
            key={i}
            type="button"
            role="gridcell"
            aria-label={`Клетка ${i + 1}: ${NAMES[mark] ?? 'пусто'}`}
            disabled={!canMove || mark !== '-'}
            $mark={line?.includes(i) ? 'win' : i === lastCell ? 'last' : undefined}
            onClick={() => onPlace(i)}
          >
            {mark !== '-' && <Mark $o={mark === 'O'}>{mark === 'X' ? '✕' : '◯'}</Mark>}
          </Cell>
        ))}
      </Grid>
    </Frame>
  )
}
