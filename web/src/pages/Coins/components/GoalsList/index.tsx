import { GoalCard } from '@/components/GoalCard'
import { useIdentity } from '@/identity/context'
import { useListGoalsQuery } from '@/store/goals'
import { List } from '../../styles'

// Цели ребёнка под балансом: сколько накоплено до каждой; нажатие открывает карточку цели с кнопкой «Оплатить».
// Целей нет (или не загрузились): блока нет.
export function GoalsList({ balance }: { balance: number }) {
  const { identity } = useIdentity()
  const memberId = identity?.memberId
  const { data } = useListGoalsQuery(memberId ?? '', { skip: !memberId })
  const goals = data?.goals

  if (!goals?.length) return null
  return (
    <section>
      <h2>Мои цели</h2>
      <List>{goals.map((goal) => <GoalCard key={goal.id} goal={goal} balance={balance} />)}</List>
    </section>
  )
}
