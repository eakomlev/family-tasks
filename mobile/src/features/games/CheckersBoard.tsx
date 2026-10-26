import { useMemo, useState } from 'react'
import { Pressable, View, useWindowDimensions } from 'react-native'
import { useTheme } from 'styled-components/native'
import { Text } from '@/components/Text'
import { BoardCoord } from './BoardCoord'

const FILES = 'abcdefgh'
const LIGHT = '#eadfc8'
const DARK = '#a9835a'
const LAST_MOVE = 'rgba(255, 214, 10, 0.55)'
const SELECTED = 'rgba(75, 59, 255, 0.45)'

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
  const { fontScale } = useTheme()
  const { width } = useWindowDimensions()
  const size = Math.floor(Math.min(width - 32, 440) / 8)
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

  const rows = orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
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

  const man = Math.round(size * 0.78)

  return (
    <View style={{ width: size * 8, height: size * 8, alignSelf: 'center', borderRadius: 6, overflow: 'hidden' }} accessibilityLabel="Шашечная доска">
      {rows.map((r, row) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {columns.map((f, col) => {
            const square = `${FILES[f]}${r + 1}`
            const piece = board[r * 8 + f]
            const dark = (f + r) % 2 === 0
            const highlight = prefix.includes(square) ? SELECTED : lastPath?.includes(square) ? LAST_MOVE : undefined
            const white = piece === 'w' || piece === 'W'
            const king = piece === 'W' || piece === 'B'
            return (
              <Pressable
                key={square}
                disabled={!canMove || !dark}
                onPress={() => press(square)}
                accessibilityLabel={`${square}${piece !== '.' ? `, ${white ? 'белая' : 'чёрная'} ${king ? 'дамка' : 'шашка'}` : ''}${next.has(square) ? ', можно сходить' : ''}`}
                style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? DARK : LIGHT }}
              >
                {highlight && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: highlight }} />}
                {col === 0 && <BoardCoord kind="rank" label={r + 1} onDark={dark} size={size} />}
                {row === 7 && <BoardCoord kind="file" label={FILES[f]} onDark={dark} size={size} />}
                {piece !== '.' && (
                  <View
                    style={{
                      width: man,
                      height: man,
                      borderRadius: man / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: white ? '#f3ead2' : '#26262b',
                      borderWidth: 2,
                      borderColor: starts.has(square) ? '#4b3bff' : white ? '#b9a785' : '#000000',
                    }}
                  >
                    {king && (
                      <Text style={{ fontSize: man * 0.55 * Math.min(fontScale, 1), lineHeight: man, includeFontPadding: false, color: white ? '#8a6d2f' : '#f2b94b' }}>{'♛︎'}</Text>
                    )}
                  </View>
                )}
                {next.has(square) && <View pointerEvents="none" style={{ position: 'absolute', width: size * 0.3, height: size * 0.3, borderRadius: size, backgroundColor: 'rgba(0,0,0,0.3)' }} />}
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
