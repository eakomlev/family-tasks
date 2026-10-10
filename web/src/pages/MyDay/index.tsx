import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { useNow } from '@/lib/useNow'
import { DateLine, Empty, Hero, Icon } from './styles'
import { FamilyLessons } from './components/FamilyLessons'
import { TodayLessons } from './components/TodayLessons'
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
      <TodayLessons now={now} />
      <TodayTrainings now={now} />
      <FamilyLessons now={now} />
      <Empty>Здесь появятся ваши дела на сегодня.</Empty>
    </Page>
  )
}
