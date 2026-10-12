import { useEffect, useState } from 'react'
import { listGoals, type Goal } from '@/api'
import { GoalCard } from '@/components/GoalCard'
import { useIdentity } from '@/identity/context'
import { useLive } from '@/realtime/context'
import { List } from '../../styles'

// Цели ребёнка под балансом: сколько накоплено до каждой; нажатие открывает карточку цели с кнопкой «Оплатить».
// Целей нет (или не загрузились): блока нет.
export function GoalsList({ balance }: { balance: number }) {
  const { identity } = useIdentity()
  const [goals, setGoals] = useState<Goal[]>()
  const [version, setVersion] = useState(0)
  useLive(['goals'], () => setVersion((v) => v + 1))

  const token = identity?.token
  const memberId = identity?.memberId
  useEffect(() => {
    if (!token || !memberId) return
    let cancelled = false
    listGoals(token, memberId)
      .then((res) => !cancelled && setGoals(res.goals))
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, memberId, version])

  if (!goals?.length) return null
  return (
    <section>
      <h2>Мои цели</h2>
      <List>{goals.map((goal) => <GoalCard key={goal.id} goal={goal} balance={balance} />)}</List>
    </section>
  )
}
