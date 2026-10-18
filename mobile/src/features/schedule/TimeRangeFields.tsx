import { View } from 'react-native'
import { Button } from '@/components/Button'
import { DateTimeField } from '@/components/DateTimeField'
import { Text } from '@/components/Text'

// Начало и окончание: два выбора времени подряд; пустое значение — времени нет
export function TimeRangeFields({
  startsAt,
  endsAt,
  label,
  onChange,
}: {
  startsAt: string
  endsAt: string
  label: string
  onChange: (patch: { startsAt?: string; endsAt?: string }) => void
}) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <DateTimeField mode="time" value={startsAt} onChange={(startsAt) => onChange({ startsAt })} accessibilityLabel={`${label}: начало`} />
        </View>
        <Text $tone="muted">–</Text>
        <View style={{ flex: 1 }}>
          <DateTimeField mode="time" value={endsAt} onChange={(endsAt) => onChange({ endsAt })} accessibilityLabel={`${label}: окончание`} />
        </View>
      </View>
      {(startsAt !== '' || endsAt !== '') && (
        <Button variant="text" onPress={() => onChange({ startsAt: '', endsAt: '' })}>
          Убрать время
        </Button>
      )}
    </View>
  )
}
