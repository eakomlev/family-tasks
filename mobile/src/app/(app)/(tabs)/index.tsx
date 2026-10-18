import { useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useDispatch } from 'react-redux'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, PageTitle } from '@/components/Text'
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

const TAB_BAR_RESERVE = 88

// «Мой день»: приветствие и настроение, прогресс дня, задания, уроки и тренировки ребёнка, сводка по детям для взрослых
export default function MyDay() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const dispatch = useDispatch()
  const router = useRouter()
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
      bottomReserve={TAB_BAR_RESERVE}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void dispatch(api.util.invalidateTags(['Me', 'Tasks', 'Goals', 'Schedule', 'Trainings']))} />}
    >
      <Stack $gap={4}>
        {/* вход в семейный календарь */}
        <Pressable onPress={() => router.push('/calendar')} accessibilityRole="button" accessibilityLabel="Семейный календарь" style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
          <Ionicons name="calendar-outline" size={30} color="#4b3bff" />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <PageTitle style={{ flex: 1 }}>{`${greeting.icon} ${greeting.text}, ${identity?.name}!`}</PageTitle>
          {isChild && mood && (
            <Pressable onPress={() => setMoodOpen(true)} accessibilityRole="button" accessibilityLabel={`Настроение: ${mood.label}. Изменить`}>
              <Text $size={34}>{mood.emoji}</Text>
            </Pressable>
          )}
        </View>
        <Text $tone="muted">{formatToday(now)}</Text>
      </Stack>
      <PushPrompt />
      <DayProgressCard now={now} />
      <EarnedToday now={now} />
      <PendingReview />
      <TodayTasks now={now} />
      <TodayLessons now={now} />
      <TodayTrainings now={now} />
      <FamilyChildren now={now} />
      {(forced || moodOpen) && <MoodDialog current={mood?.value} forced={forced} onPick={pickMood} onClose={() => setMoodOpen(false)} />}
    </Screen>
  )
}
