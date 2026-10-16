import { useState } from 'react'
import { CalendarIcon } from '@/components/CalendarIcon'
import { MoodDialog } from '@/components/MoodDialog'
import { Page } from '@/components/Page'
import { PendingReview } from '@/components/PendingReview'
import { useIdentity } from '@/identity/context'
import { currentMood } from '@/lib/mood'
import { useNow } from '@/lib/useNow'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useSetMoodMutation } from '@/store/profile'
import { CalendarLink, DateLine, GreetingRow, Hero, Icon, MoodButton } from './styles'
import { DailyFact } from './components/DailyFact'
import { EarnedToday } from './components/EarnedToday'
import { FamilyLessons } from './components/FamilyLessons'
import { TodayLessons } from './components/TodayLessons'
import { TodayTasks } from './components/TodayTasks'
import { TodayTrainings } from './components/TodayTrainings'
import { formatToday, getGreeting } from './utils'

export default function MyDay() {
  const { identity } = useIdentity()
  const now = useNow()
  const greeting = getGreeting(now)
  const { data } = useProfile()
  const [setMood] = useSetMoodMutation()
  const [moodOpen, setMoodOpen] = useState(false)

  // настроение есть только у детей: утром (с 5 часов) выбор показывается принудительно, потом по нажатию на смайлик
  const isChild = identity?.role === 'child'
  const mood = currentMood(data?.me.mood, now)
  const forced = isChild && !!data && !mood && now.getHours() >= 5

  async function pickMood(value: number) {
    // настроение показывается сразу (кэш профиля обновляется до ответа сервера), при ошибке откатывается и диалог остаётся
    await setMood(value).unwrap().catch(toApiError)
    setMoodOpen(false)
  }

  return (
    <Page>
      <Hero>
        {/* слева вверху семейный календарь со сегодняшним числом */}
        <CalendarLink to="/calendar" aria-label="Семейный календарь">
          <CalendarIcon day={now.getDate()} />
        </CalendarLink>
        <GreetingRow>
          <h1>{greeting.text}, {identity?.name}!</h1>
          {isChild ? (
            // настроение вместо значка времени суток; нажатие открывает выбор
            <MoodButton type="button" aria-label={mood ? `Настроение: ${mood.label}. Изменить` : 'Выбрать настроение'} onClick={() => setMoodOpen(true)}>
              {mood?.emoji ?? greeting.icon}
            </MoodButton>
          ) : (
            <Icon aria-hidden>{greeting.icon}</Icon>
          )}
        </GreetingRow>
        <DateLine>{formatToday(now)}</DateLine>
      </Hero>
      <DailyFact now={now} />
      <EarnedToday now={now} />
      <PendingReview />
      <TodayTasks now={now} />
      <TodayLessons now={now} />
      <TodayTrainings now={now} />
      <FamilyLessons now={now} />
      {(forced || moodOpen) && <MoodDialog current={mood?.value} forced={forced} onPick={pickMood} onClose={() => setMoodOpen(false)} />}
    </Page>
  )
}
