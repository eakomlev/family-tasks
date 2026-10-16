import { useState } from 'react'
import { Button } from '@/components/Button'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { closeFact, factOfDay, factsForAge, isFactClosed, shouldShowFact } from '@/lib/dailyFact'
import { Card, Emoji, Head, Label, Text, Title } from './styles'
import type { DailyFactProps } from './types'

// Один интересный факт в день для ребёнка: с 9:00, пока он не нажмёт «Класс!».
export function DailyFact({ now }: DailyFactProps) {
  const { identity } = useIdentity()
  const { data } = useProfile()
  // закрытие запоминается на устройстве; состояние нужно, чтобы карточка исчезла сразу
  const [closedDay, setClosedDay] = useState<string | null>(null)

  if (identity?.role !== 'child' || !data || !shouldShowFact(now)) return null
  const memberId = identity.memberId
  const today = now.toDateString()
  if (closedDay === today || isFactClosed(memberId, now)) return null

  const fact = factOfDay(factsForAge(data.me.birthDate, now), now)

  function close() {
    closeFact(memberId, now)
    setClosedDay(today)
  }

  return (
    <Card aria-label="Факт дня">
      <Head>
        <Emoji aria-hidden>{fact.emoji}</Emoji>
        <div>
          <Label>Факт дня · {fact.category}</Label>
          <Title>{fact.title}</Title>
        </div>
      </Head>
      <Text>{fact.text}</Text>
      <Button type="button" onClick={close}>Класс!</Button>
    </Card>
  )
}
