import { Text } from 'react-native'

const LIGHT = '#eadfc8'
const DARK = '#a9835a'

interface Props {
  kind: 'rank' | 'file'
  label: string | number
  // подпись стоит на тёмной клетке (цвет берём контрастный к клетке)
  onDark: boolean
  // сторона клетки в пикселях
  size: number
}

// Подпись линии в углу клетки, как на chess.com: номер ряда слева сверху у левого края доски, буква вертикали справа снизу у нижнего края.
// Размер не масштабируется шрифтом приложения: подпись должна оставаться внутри угла клетки.
export function BoardCoord({ kind, label, onDark, size }: Props) {
  const font = Math.max(9, Math.round(size * 0.26))
  return (
    <Text
      pointerEvents="none"
      allowFontScaling={false}
      importantForAccessibility="no"
      style={{
        position: 'absolute',
        ...(kind === 'rank' ? { top: size * 0.04, left: size * 0.07 } : { bottom: size * 0.02, right: size * 0.07 }),
        fontSize: font,
        lineHeight: font + 1,
        fontWeight: '800',
        includeFontPadding: false,
        color: onDark ? LIGHT : DARK,
      }}
    >
      {label}
    </Text>
  )
}
