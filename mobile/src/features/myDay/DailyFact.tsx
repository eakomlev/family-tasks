import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { closeFact, factOfDay, factsForAge, isFactClosed, shouldShowFact } from '@/lib/dailyFact'
import { useProfile } from '@/profile/context'

// Один интересный факт в день для ребёнка: с 9:00, пока он не нажмёт «Класс!».
export function DailyFact({ now }: { now: Date }) {
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
    <Card accessibilityLabel="Факт дня" style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text $size={35} accessibilityElementsHidden>{fact.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text $tone="muted" $weight="extraBold" $size={13}>{`Факт дня · ${fact.category}`}</Text>
          <Text $weight="black" $size={19}>{fact.title}</Text>
        </View>
      </View>
      <Text $size={16}>{fact.text}</Text>
      <Button variant="lime" onPress={close} style={{ alignSelf: 'flex-start' }}>Класс!</Button>
    </Card>
  )
}
