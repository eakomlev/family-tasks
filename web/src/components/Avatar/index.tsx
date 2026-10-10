import { Circle } from './styles'
import type { AvatarProps } from './types'
import { getAvatarColor, getInitial } from './utils'

export function Avatar({ name, seed, size = '2.5rem' }: AvatarProps) {
  return (
    <Circle $color={getAvatarColor(seed)} $size={size} aria-hidden>
      {getInitial(name)}
    </Circle>
  )
}
