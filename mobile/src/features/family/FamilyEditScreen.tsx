import { useState } from 'react'
import { View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { useDispatch } from 'react-redux'
import styled from 'styled-components/native'
import { ApiError, removeMember, type Member } from '@/api'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { isAdult, ROLE_LABELS } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.surface};
`

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
  if (err instanceof ApiError && err.status === 403) return 'Менять состав семьи может только её создатель.'
  if (err instanceof ApiError && err.status === 404) return 'Такого участника уже нет в семье.'
  return 'Не удалось выполнить. Попробуйте ещё раз.'
}

// Изменение семьи (только создатель): убрать взрослого из семьи, полностью удалить аккаунт ребёнка, удалить семью целиком.
// Убранный взрослый теряет всё семейное, но аккаунт остаётся (без семьи): приложение предложит ему создать семью или вступить в другую.
export function FamilyEditScreen() {
  const { identity } = useIdentity()
  const { data } = useProfile()
  const guard = useInFlight()
  const confirm = useConfirm()
  const dispatch = useDispatch()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string>()
  const [error, setError] = useState<string>()

  const remove = guard(async (member: Member) => {
    const adult = isAdult(member.role)
    const ok = await confirm(
      adult
        ? {
            title: `Убрать ${member.name} из семьи?`,
            message: 'Его личные переписки, сообщения, задания и события в этой семье пропадут. Сам аккаунт останется: при следующем открытии приложения человеку предложат создать свою семью или присоединиться к другой по ссылке.',
            confirmLabel: 'Убрать',
            danger: true,
          }
        : {
            title: `Удалить аккаунт ${member.name}?`,
            message: 'Аккаунт ребёнка будет удалён полностью: задания, расписания, монеты, цели, сообщения и личные чаты. Отменить это нельзя.',
            confirmLabel: 'Удалить',
            danger: true,
          },
    )
    if (!ok || !identity) return
    setBusyId(member.id)
    setError(undefined)
    try {
      await removeMember(identity.token, member.id)
      dispatch(api.util.invalidateTags(['Me']))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusyId(undefined)
    }
  })

  if (!identity) return <Redirect href="/welcome" />
  // менять семью может только создатель; пока профиль не загружен, экран не прыгает
  if (data && !data.me.isOwner) return <Redirect href="/family" />

  const others = data?.members.filter((m) => m.id !== identity.memberId) ?? []

  return (
    <Screen header={<PageHeader fallback="/family">Изменить семью</PageHeader>}>
      <Heading>Участники</Heading>
      {!data && <Text $tone="muted">Загрузка…</Text>}
      {data && others.length === 0 && <Notice>В семье пока никого, кроме вас.</Notice>}
      <View style={{ gap: 8 }}>
        {others.map((m) => (
          <Row key={m.id}>
            <Avatar name={m.name} seed={m.id} src={m.avatar} size={44} />
            <View style={{ flex: 1 }}>
              <Text $weight="extraBold">{m.name}</Text>
              <Text $size={13} $tone="muted">
                {ROLE_LABELS[m.role]}
              </Text>
            </View>
            <Button variant="danger" disabled={busyId !== undefined} onPress={() => void remove(m)}>
              {isAdult(m.role) ? 'Убрать' : 'Удалить'}
            </Button>
          </Row>
        ))}
      </View>
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="text" onPress={() => router.push('/family/delete')}>
        Удалить семейный аккаунт
      </Button>
    </Screen>
  )
}
