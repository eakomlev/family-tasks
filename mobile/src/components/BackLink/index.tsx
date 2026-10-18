import { Pressable } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { goBack } from '@/lib/navigation'

// Стрелка «назад» в левом верхнем углу: возвращает на экран, с которого пришли; если истории нет (открыли по ссылке),
// ведёт на запасной адрес. Подпись нужна только скринридеру.
export function BackLink({ fallback, children = 'Назад' }: { fallback: Href; children?: string }) {
  const router = useRouter()
  const { colors } = useTheme()
  const label = children.replace(/^←\s*/, '')
  return (
    <Pressable
      onPress={() => goBack(router, fallback)}
      accessibilityRole="button"
      accessibilityLabel={`Назад: ${label}`}
      hitSlop={12}
      style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
    >
      <Ionicons name="chevron-back" size={28} color={colors.text} />
    </Pressable>
  )
}
