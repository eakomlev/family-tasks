import { Ghost, Hidden, Wrap } from './styles'

// пузыри: [свой?, ширина, высота]
const GHOSTS: [boolean, string, string][] = [
  [false, '58%', '2.4rem'],
  [false, '36%', '2rem'],
  [true, '48%', '2.4rem'],
  [false, '64%', '3.4rem'],
  [true, '30%', '2rem'],
  [true, '52%', '2.4rem'],
]

// Пока сообщения загружаются, на их месте серые пузыри: шапка, лента и поле ввода уже стоят на своих местах
export function MessagesSkeleton() {
  return (
    <Wrap role="status" aria-busy="true">
      <Hidden>Загрузка…</Hidden>
      {GHOSTS.map(([mine, width, height], i) => (
        <Ghost key={i} $mine={mine} $width={width} $height={height} aria-hidden />
      ))}
    </Wrap>
  )
}
