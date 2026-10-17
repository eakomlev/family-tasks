import { useIdentity } from '@/identity/context'
import { todayIso } from '@/lib/date'
import { useProfile } from '@/profile/context'
import { useListGoalsQuery } from '@/store/goals'
import { useListTasksQuery } from '@/store/tasks'
import { Bar, Card, Fill, GoalLink, Label, Ring, Text, Title } from './styles'
import type { DayProgressProps } from './types'
import { countToday, currentGoal, goalProgress, progressTitle } from './utils'

const R = 34
const LENGTH = 2 * Math.PI * R

// Яркий блок «Квеста» наверху «Моего дня»: кольцо выполненных сегодня заданий и у ребёнка путь к ближайшей цели.
export function DayProgress({ now }: DayProgressProps) {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const today = todayIso(now)
  const me = identity?.memberId
  const isChild = identity?.role === 'child'
  // тот же запрос, что у «Заданий на сегодня»: данные берутся из общего кэша
  const { data: list } = useListTasksQuery({ from: today, to: today })
  const { data: goals } = useListGoalsQuery(me ?? '', { skip: !isChild || !me })

  const count = list && me ? countToday(list, me, today) : null
  const goal = isChild ? currentGoal(goals?.goals) : null
  const balance = profile?.me.coins ?? 0
  // пока нечего показать (нет ни заданий на сегодня, ни цели), блока нет
  if (!count || (count.total === 0 && !goal)) return null

  const share = count.total > 0 ? count.done / count.total : 0
  const path = goal ? goalProgress(goal, balance) : null

  return (
    <Card aria-label="Прогресс дня">
      <Ring viewBox="0 0 86 86" role="img" aria-label={`Сделано заданий: ${count.done} из ${count.total}`}>
        <circle cx="43" cy="43" r={R} data-track />
        {share > 0 && <circle cx="43" cy="43" r={R} data-fill strokeDasharray={`${share * LENGTH} ${LENGTH}`} />}
        <text x="43" y="50" textAnchor="middle">{count.done}/{count.total}</text>
      </Ring>
      <Text>
        <Label>Прогресс дня</Label>
        <Title>{progressTitle(count)}</Title>
        {goal && path && (
          <GoalLink to={`/goals/${goal.id}`}>
            <Bar aria-hidden>
              <Fill style={{ width: `${path.share * 100}%` }} />
            </Bar>
            <Label>{path.text}</Label>
          </GoalLink>
        )}
      </Text>
    </Card>
  )
}
