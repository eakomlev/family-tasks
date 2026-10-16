import { Navigate, useParams } from 'react-router-dom'
import { isAdult, isParent } from '@/lib/roles'
import { BackLink } from '@/components/BackLink'
import { GoalCard } from '@/components/GoalCard'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { useListGoalsQuery } from '@/store/goals'
import { AddButton, List, ListEnd } from './styles'

// Цели ребёнка для родителей: список, внизу кнопка «Новая цель». Ребёнок видит свои цели на странице монет.
export default function Goals() {
  const { memberId } = useParams()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const isAdultViewer = isAdult(identity?.role)
  const canEdit = isParent(identity?.role)
  // из кэша сразу, свежее приходит следом и после каждого изменения целей
  const query = useListGoalsQuery(memberId ?? '', { skip: !memberId || !isAdultViewer })
  const goals = query.data?.goals
  const failed = query.isError && !goals

  if (!identity) return null
  if (!isAdultViewer) return <Navigate to="/coins" replace />
  const child = data?.members.find((m) => m.id === memberId)
  if (data && (!child || child.role !== 'child')) return <Navigate to="/family" replace />

  return (
    <Page>
      <BackLink to={`/family/${memberId}`}>← {child?.name ?? 'Назад'}</BackLink>
      <h1>{child ? `Цели: ${child.name}` : 'Цели'}</h1>
      {failed && !goals && <Notice $tone="error">Не удалось загрузить цели. Проверьте соединение.</Notice>}
      {!goals && !failed && <p>Загрузка…</p>}
      {goals && goals.length === 0 && <Notice $tone="muted">Целей пока нет.{canEdit && ' Добавьте то, на что ребёнок будет копить монеты.'}</Notice>}
      {goals && goals.length > 0 && <List>{goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</List>}
      {canEdit && <AddButton to={`/family/${memberId}/goals/new`}>＋ Новая цель</AddButton>}
      <ListEnd />
    </Page>
  )
}
