export interface AvatarProps {
  name: string
  // от него зависит цвет буквы-заглушки, чтобы у одного человека он всегда был одинаковым
  seed: string
  // data URL фото; если есть, показываем его вместо буквы
  src?: string | null
  size?: string
}
