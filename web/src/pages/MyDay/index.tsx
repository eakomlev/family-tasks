import { Page } from '@/components/Page'
import { PendingReview } from '@/components/PendingReview'
import { useIdentity } from '@/identity/context'
import { useNow } from '@/lib/useNow'
import { DateLine, Hero, Icon } from './styles'
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

  return (
    <Page>
      <Hero>
        <Icon aria-hidden>{greeting.icon}</Icon>
        <h1>{greeting.text}, {identity?.name}!</h1>
        <DateLine>{formatToday(now)}</DateLine>
      </Hero>
      <EarnedToday now={now} />
      <PendingReview />
      <TodayTasks now={now} />
      <TodayLessons now={now} />
      <TodayTrainings now={now} />
      <FamilyLessons now={now} />
    </Page>
  )
}
