import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { listGoals, type Goal } from '@/api'
import { BackLink } from '@/components/BackLink'
import { GoalCard } from '@/components/GoalCard'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { useLive } from '@/realtime/context'
import { AddButton, List, ListEnd } from './styles'

// Цели ребёнка для родителей: список, внизу кнопка «Новая цель». Ребёнок видит свои цели на странице монет.
export default function Goals() {
  const { memberId } = useParams()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const [goals, setGoals] = useState<Goal[]>()
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  useLive(['goals'], () => setVersion((v) => v + 1))

  const token = identity?.token
  const isParent = !!identity && identity.role !== 'child'

  useEffect(() => {
    if (!token || !memberId || !isParent) return
    let cancelled = false
    listGoals(token, memberId)
      .then((res) => {
        if (cancelled) return
        setGoals(res.goals)
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => { cancelled = true }
  }, [token, memberId, isParent, version])

  if (!identity) return null
  if (!isParent) return <Navigate to="/coins" replace />
  const child = data?.members.find((m) => m.id === memberId)
  if (data && (!child || child.role !== 'child')) return <Navigate to="/family" replace />

  return (
    <Page>
      <BackLink to={`/family/${memberId}`}>← {child?.name ?? 'Назад'}</BackLink>
      <h1>{child ? `Цели: ${child.name}` : 'Цели'}</h1>
      {failed && !goals && <Notice $tone="error">Не удалось загрузить цели. Проверьте соединение.</Notice>}
      {!goals && !failed && <p>Загрузка…</p>}
      {goals && goals.length === 0 && <Notice $tone="muted">Целей пока нет. Добавьте то, на что ребёнок будет копить монеты.</Notice>}
      {goals && goals.length > 0 && <List>{goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</List>}
      <AddButton to={`/family/${memberId}/goals/new`}>＋ Новая цель</AddButton>
      <ListEnd />
    </Page>
  )
}
