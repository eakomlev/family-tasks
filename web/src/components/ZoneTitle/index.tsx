import type { ReactNode } from 'react'
import { Bar, Chip, Count, Line, Title } from './styles'
import type { ZoneIcon, ZoneTone } from './types'

// Пути значков (контурные, 24×24): у каждой зоны «Моего дня» свой
const ICONS: Record<ZoneIcon, string> = {
  hourglass: 'M7 3h10M7 21h10M8 3v3.5c0 1.5 1.4 2.6 4 5.5-2.6 2.9-4 4-4 5.5V21M16 3v3.5c0 1.5-1.4 2.6-4 5.5 2.6 2.9 4 4 4 5.5V21',
  games: 'M7 8h10a4 4 0 0 1 3.9 4.9l-.7 3.3a2.4 2.4 0 0 1-4.3.7L14.5 15h-5l-1.4 1.9a2.4 2.4 0 0 1-4.3-.7l-.7-3.3A4 4 0 0 1 7 8ZM8 10.5v3M6.5 12h3M16 11.2h.01M18 13h.01',
  tasks: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 12l3 3 5-6',
  kids: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6',
  lessons: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15ZM20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z',
  training: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
}

interface Props {
  tone: ZoneTone
  icon: ZoneIcon
  children: string
  // число рядом с названием (сколько ждёт, сколько идёт) и его подпись для скринридеров
  count?: number
  countLabel?: string
  // справа: ссылки вроде «Расписание» или «+ Добавить»
  right?: ReactNode
}

// Шапка зоны на «Моём дне»: цветной значок, название, цветная линия, ссылки и счётчик. Счётчик всегда в правом краю.
// Цвет зоны один на все её блоки: «Нужно решить», «Мой день», «Дети», «Игры» различаются с первого взгляда.
export function ZoneTitle({ tone, icon, children, count, countLabel, right }: Props) {
  return (
    <Bar>
      <Chip $tone={tone} aria-hidden>
        <svg viewBox="0 0 24 24">
          <path d={ICONS[icon]} />
        </svg>
      </Chip>
      <Title $tone={tone}>{children}</Title>
      <Line $tone={tone} aria-hidden />
      {right}
      {count !== undefined && <Count $tone={tone} aria-label={countLabel}>{count}</Count>}
    </Bar>
  )
}
