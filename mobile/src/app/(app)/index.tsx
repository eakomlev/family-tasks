import { RefreshControl } from 'react-native'
import { useDispatch } from 'react-redux'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { DayProgressCard } from '@/features/myDay/DayProgressCard'
import { TodayTasks } from '@/features/myDay/TodayTasks'
import { formatToday, getGreeting } from '@/features/myDay/utils'
import { useIdentity } from '@/identity/context'
import { useNow } from '@/lib/useNow'
import { api } from '@/store/api'

const TAB_BAR_RESERVE = 88

// «Мой день»: приветствие, прогресс дня и задания на сегодня. Уроки, тренировки, настроение и блоки родителя добавятся по ходу фазы 2.
export default function MyDay() {
  const { identity } = useIdentity()
  const dispatch = useDispatch()
  const now = useNow()
  const greeting = getGreeting(now)

  return (
    <Screen
      bottomReserve={TAB_BAR_RESERVE}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void dispatch(api.util.invalidateTags(['Me', 'Tasks', 'Goals']))} />}
    >
      <Stack $gap={4}>
        <Title>{`${greeting.icon} ${greeting.text}, ${identity?.name}!`}</Title>
        <Text $tone="muted">{formatToday(now)}</Text>
      </Stack>
      <DayProgressCard now={now} />
      <TodayTasks now={now} />
    </Screen>
  )
}
