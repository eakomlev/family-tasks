import styled from 'styled-components'
import { currentMood, type MoodValue } from '@/lib/mood'

const Mark = styled.span`
  flex: none;
  font-size: 1em;
  line-height: 1;
`

// Смайлик сегодняшнего настроения справа от имени; нет настроения (или оно вчерашнее): ничего.
export function MoodMark({ mood, now }: { mood?: MoodValue | null; now: Date }) {
  const current = currentMood(mood, now)
  if (!current) return null
  return (
    <Mark role="img" aria-label={`Настроение: ${current.label}`} title={current.label}>
      {current.emoji}
    </Mark>
  )
}
