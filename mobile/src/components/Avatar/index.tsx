import { Image } from 'react-native'
import styled from 'styled-components/native'
import { Text } from '../Text'
import { getAvatarColor, getInitial } from './utils'

const Circle = styled.View<{ $color: string; $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $size }) => $size / 2}px;
  background-color: ${({ $color }) => $color};
  align-items: center;
  justify-content: center;
  overflow: hidden;
`

interface AvatarProps {
  name: string
  // от него зависит цвет кружка без фото
  seed: string
  // фото: data URL, как его хранит сервер
  src?: string | null
  size?: number
}

// Фото участника, а без него круг стабильного цвета с первой буквой имени
export function Avatar({ name, seed, src, size = 40 }: AvatarProps) {
  return (
    <Circle $color={getAvatarColor(seed)} $size={size} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} />
      ) : (
        <Text $weight="black" $size={Math.round(size * 0.45)} style={{ color: '#ffffff' }}>
          {getInitial(name)}
        </Text>
      )}
    </Circle>
  )
}
