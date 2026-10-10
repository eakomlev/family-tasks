import { Circle, Photo } from './styles'
import type { AvatarProps } from './types'
import { getAvatarColor, getInitial } from './utils'

export function Avatar({ name, seed, src, size = '2.5rem' }: AvatarProps) {
  return (
    <Circle $color={getAvatarColor(seed)} $size={size} aria-hidden>
      {src ? <Photo src={src} alt="" /> : getInitial(name)}
    </Circle>
  )
}
