import { useState } from 'react'
import { useTheme } from 'styled-components/native'
import { Pressable, RefreshControl, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useDispatch } from 'react-redux'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { ActiveGames } from '@/features/games/ActiveGames'
import { DayProgressCard } from '@/features/myDay/DayProgressCard'
import { EarnedToday } from '@/features/myDay/EarnedToday'
import { FamilyChildren } from '@/features/myDay/FamilyChildren'
import { MoodDialog } from '@/features/myDay/MoodDialog'
import { TodayLessons, TodayTrainings } from '@/features/myDay/TodaySchedule'
import { TodayTasks } from '@/features/myDay/TodayTasks'
import { PushPrompt } from '@/features/notifications/PushPrompt'
import { PendingReview } from '@/features/tasks/PendingReview'
import { formatToday, getGreeting } from '@/features/myDay/utils'
import { useIdentity } from '@/identity/context'
import { currentMood } from '@/lib/mood'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { api, toApiError } from '@/store/api'
import { useSetMoodMutation } from '@/store/profile'


// «Мой день»: приветствие и настроение, прогресс дня, задания, уроки и тренировки ребёнка, сводка по детям для взрослых
export default function MyDay() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const dispatch = useDispatch()
  const router = useRouter()
  const { colors } = useTheme()
  const now = useNow()
  const greeting = getGreeting(now)
  const [setMood] = useSetMoodMutation()
  const [moodOpen, setMoodOpen] = useState(false)

  // настроение есть только у детей: утром (с 5 часов) выбор показывается принудительно, потом по нажатию на смайлик
  const isChild = identity?.role === 'child'
  const mood = currentMood(data?.me.mood, now)
  const forced = isChild && !!data && !mood && now.getHours() >= 5

  async function pickMood(value: number) {
    // настроение показывается сразу (кэш профиля обновляется до ответа сервера), при ошибке откатывается и окно остаётся
    await setMood(value).unwrap().catch(toApiError)
    setMoodOpen(false)
  }

  return (
    <Screen
      header={
        // шапка закреплена: календарь слева, справа остаётся место под монеты и значок профиля
        <Pressable onPress={() => router.push('/calendar')} accessibilityRole="button" accessibilityLabel="Семейный календарь" hitSlop={8} style={{ alignSelf: 'flex-start', height: 38, justifyContent: 'center' }}>
          <Ionicons name="calendar-outline" size={30} color={colors.text} />
        </Pressable>
      }
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void dispatch(api.util.invalidateTags(['Me', 'Tasks', 'Goals', 'Schedule', 'Trainings']))} />}
    >
      <Stack $gap={4}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Title style={{ flex: 1 }}>{`${greeting.text}, ${identity?.name}!`}</Title>
          {isChild && mood && (
            <Pressable onPress={() => setMoodOpen(true)} accessibilityRole="button" accessibilityLabel={`Настроение: ${mood.label}. Изменить`}>
              <Text $size={34}>{mood.emoji}</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.push('/calendar')} accessibilityRole="button" accessibilityLabel="Открыть календарь" hitSlop={6} style={{ alignSelf: 'flex-start' }}>
          <Text $tone="muted">{formatToday(now)}</Text>
        </Pressable>
      </Stack>
      <PushPrompt />
      <DayProgressCard now={now} />
      <EarnedToday now={now} />
      <PendingReview />
      <ActiveGames />
      <TodayTasks now={now} />
      <TodayLessons now={now} />
      <TodayTrainings now={now} />
      <FamilyChildren now={now} />
      {(forced || moodOpen) && <MoodDialog current={mood?.value} forced={forced} onPick={pickMood} onClose={() => setMoodOpen(false)} />}
    </Screen>
  )
}
