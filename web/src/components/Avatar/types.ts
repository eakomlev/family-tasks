export interface AvatarProps {
  name: string
  // от него зависит цвет, чтобы у одного человека он всегда был одинаковым
  seed: string
  size?: string
}
