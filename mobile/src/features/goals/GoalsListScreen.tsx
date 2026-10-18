import { Redirect, useRouter } from 'expo-router'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Text, PageTitle } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { isAdult, isParent } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useListGoalsQuery } from '@/store/goals'
import { GoalCard } from './GoalCard'

// Цели ребёнка для взрослых: список, внизу «Новая цель» (создают только родители). Ребёнок видит свои цели на странице монет.
export function GoalsListScreen({ memberId }: { memberId: string }) {
  const router = useRouter()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const isAdultViewer = isAdult(identity?.role)
  const canEdit = isParent(identity?.role)
  const query = useListGoalsQuery(memberId, { skip: !isAdultViewer })
  const goals = query.data?.goals
  const failed = query.isError && !goals

  if (!identity) return null
  if (!isAdultViewer) return <Redirect href="/coins" />
  const child = data?.members.find((m) => m.id === memberId)
  if (data && (!child || child.role !== 'child')) return <Redirect href="/family" />

  return (
    <Screen>
      <BackLink fallback={{ pathname: '/family/[memberId]', params: { memberId } }}>{`← ${child?.name ?? 'Назад'}`}</BackLink>
      <PageTitle>{child ? `Цели: ${child.name}` : 'Цели'}</PageTitle>
      {failed && <Notice tone="error">Не удалось загрузить цели. Проверьте соединение.</Notice>}
      {!goals && !failed && <Text $tone="muted">Загрузка…</Text>}
      {goals && goals.length === 0 && <Notice>{`Целей пока нет.${canEdit ? ' Добавьте то, на что ребёнок будет копить монеты.' : ''}`}</Notice>}
      {goals?.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
      {canEdit && (
        <Button variant="primary" onPress={() => router.push({ pathname: '/family/[memberId]/goals/new', params: { memberId } })}>
          ＋ Новая цель
        </Button>
      )}
    </Screen>
  )
}
