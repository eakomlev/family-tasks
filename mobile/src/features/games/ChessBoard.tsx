import { useMemo, useState } from 'react'
import { Modal, Pressable, View, useWindowDimensions } from 'react-native'
import { Chess, type Square } from 'chess.js'
import { useTheme } from 'styled-components/native'
import type { ChessMove, PromotionPiece } from '@/api'
import { Text } from '@/components/Text'

// Фигуры сплошными символами (с ︎, чтобы Android не рисовал их цветными эмодзи); цвет фигуры задаёт заливка
const GLYPHS: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const LIGHT = '#eadfc8'
const DARK = '#a9835a'
const LAST_MOVE = 'rgba(255, 214, 10, 0.55)'
const SELECTED = 'rgba(75, 59, 255, 0.45)'
const CHECK = 'rgba(230, 40, 40, 0.65)'

interface Props {
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

// Шахматная доска: нажатие на свою фигуру показывает, куда она может пойти, нажатие на подсвеченную клетку делает ход.
// Правила (допустимые ходы, шах) считает chess.js, окончательно ход проверяет сервер.
export function ChessBoard({ fen, orientation, lastMove, canMove, onMove }: Props) {
  const { colors, fontScale } = useTheme()
  const { width } = useWindowDimensions()
  const size = Math.floor(Math.min(width - 32, 440) / 8)
  const [selected, setSelected] = useState<string | null>(null)
  // пешка дошла до края: ждём, во что её превратить
  const [promoting, setPromoting] = useState<{ from: string; to: string } | null>(null)

  const chess = useMemo(() => new Chess(fen), [fen])
  const board = chess.board()
  const turn = chess.turn()
  const targets = useMemo(() => {
    if (!selected) return new Set<string>()
    return new Set(chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to))
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
      const isPromotion = chess.moves({ square: selected as Square, verbose: true }).some((m) => m.to === square && m.promotion)
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
    <View style={{ width: size * 8, height: size * 8, alignSelf: 'center', borderRadius: 6, overflow: 'hidden' }} accessibilityLabel="Шахматная доска">
      {order.map((r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {order.map((f) => {
            const cell = board[r][f]
            const square = `${FILES[f]}${8 - r}`
            const dark = (r + f) % 2 === 1
            const highlight = kingInCheck === square ? CHECK : selected === square ? SELECTED : lastMove && (lastMove.from === square || lastMove.to === square) ? LAST_MOVE : undefined
            const target = targets.has(square)
            return (
              <Pressable
                key={square}
                onPress={() => press(square, cell?.color)}
                accessibilityLabel={`${square}${cell ? `, ${cell.color === 'w' ? 'белая' : 'чёрная'} фигура` : ''}`}
                style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? DARK : LIGHT }}
              >
                {highlight && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: highlight }} />}
                {cell && (
                  <Text
                    style={{
                      fontSize: size * 0.78 * Math.min(fontScale, 1),
                      lineHeight: size,
                      includeFontPadding: false,
                      color: cell.color === 'w' ? '#ffffff' : '#1b1b1f',
                      textShadowColor: cell.color === 'w' ? '#1b1b1f' : '#ffffff',
                      textShadowRadius: 2,
                      textShadowOffset: { width: 0, height: 0 },
                    }}
                  >
                    {`${GLYPHS[cell.type]}︎`}
                  </Text>
                )}
                {target && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      width: cell ? size * 0.9 : size * 0.3,
                      height: cell ? size * 0.9 : size * 0.3,
                      borderRadius: size,
                      backgroundColor: cell ? 'transparent' : 'rgba(0,0,0,0.3)',
                      borderWidth: cell ? 3 : 0,
                      borderColor: 'rgba(0,0,0,0.3)',
                    }}
                  />
                )}
              </Pressable>
            )
          })}
        </View>
      ))}
      {promoting && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPromoting(null)}>
          <Pressable
            onPress={() => setPromoting(null)}
            accessibilityLabel="Отменить выбор"
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
          >
            <View accessibilityLabel="Во что превратить пешку?" style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 18, backgroundColor: colors.surface }}>
              {PROMOTION_CHOICES.map(({ piece, name }) => (
                <Pressable
                  key={piece}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  onPress={() => {
                    onMove(promoting.from, promoting.to, piece)
                    setPromoting(null)
                  }}
                  style={{ width: 62, height: 62, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: LIGHT }}
                >
                  <Text
                    style={{
                      fontSize: 44 * Math.min(fontScale, 1),
                      lineHeight: 62,
                      includeFontPadding: false,
                      color: orientation === 'w' ? '#ffffff' : '#1b1b1f',
                      textShadowColor: orientation === 'w' ? '#1b1b1f' : '#ffffff',
                      textShadowRadius: 2,
                      textShadowOffset: { width: 0, height: 0 },
                    }}
                  >
                    {`${GLYPHS[piece]}︎`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  )
}
