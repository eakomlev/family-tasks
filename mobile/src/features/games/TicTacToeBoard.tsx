import { Pressable, View, useWindowDimensions } from 'react-native'
import { useTheme } from 'styled-components/native'
import { Text } from '@/components/Text'
import { winningLine } from './ticTacToe'

interface Props {
  // 9 знаков по строкам: «X», «O» или «-»
  board: string
  lastCell: number | null
  // можно ли сейчас ходить (мой ход, игра идёт, запрос не в полёте)
  canMove: boolean
  onPlace: (cell: number) => void
}

const NAMES: Record<string, string> = { X: 'крестик', O: 'нолик', '-': 'пусто' }
const GAP = 8

// Поле 3×3: нажатие на пустую клетку делает ход. Последний ход и выигравшая линия подсвечены.
export function TicTacToeBoard({ board, lastCell, canMove, onPlace }: Props) {
  const { colors, fontScale } = useTheme()
  const { width } = useWindowDimensions()
  const size = Math.floor((Math.min(width - 32, 320) - GAP * 2) / 3)
  const line = winningLine(board)

  return (
    <View style={{ width: size * 3 + GAP * 2, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: GAP }} accessibilityLabel="Поле крестиков-ноликов">
      {Array.from(board).map((mark, i) => {
        const win = !!line?.includes(i)
        return (
          <Pressable
            key={i}
            disabled={!canMove || mark !== '-'}
            onPress={() => onPlace(i)}
            accessibilityLabel={`Клетка ${i + 1}: ${NAMES[mark] ?? 'пусто'}`}
            style={{
              width: size,
              height: size,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.cardBorder,
              backgroundColor: win ? colors.doneBg : i === lastCell ? colors.track : colors.surface,
            }}
          >
            {mark !== '-' && (
              <Text style={{ fontSize: size * 0.6 * Math.min(fontScale, 1), lineHeight: size, includeFontPadding: false, fontWeight: '900', color: mark === 'O' ? colors.coin : colors.accent }}>
                {mark === 'X' ? '✕' : '◯'}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}
