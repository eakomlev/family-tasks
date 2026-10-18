import { Pressable, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import styled from 'styled-components/native'
import { Avatar } from '@/components/Avatar'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { Heading, Text, PageTitle } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { MAX_FAMILY_MEMBERS, ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'

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

// «Моя семья»: участники; пригласить может только создатель
export function FamilyScreen() {
  const { identity } = useIdentity()
  const { data, failed } = useProfile()
  const router = useRouter()

  if (!identity) return <Redirect href="/welcome" />

  return (
    <Screen>
      <PageTitle>Ваша семья</PageTitle>
      <Text>{`Вы вошли как ${identity.name} (${ROLE_LABELS[identity.role]}).`}</Text>

      <Heading>{`Участники${data ? ` (${data.members.length} из ${MAX_FAMILY_MEMBERS})` : ''}`}</Heading>
      {failed && !data && <Notice tone="error">Не удалось загрузить список. Проверьте соединение.</Notice>}
      {!data && !failed && <Text $tone="muted">Загрузка…</Text>}
      <View style={{ gap: 8 }}>
        {data?.members.map((m) => {
          const isMe = m.id === identity.memberId
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              onPress={() => (isMe ? router.push('/profile') : router.push({ pathname: '/family/[memberId]', params: { memberId: m.id } }))}
            >
              <Row>
                <Avatar name={m.name} seed={m.id} src={m.avatar} size={44} />
                <Text $weight="extraBold" style={{ flex: 1 }}>
                  {`${m.name}${isMe ? ' (вы)' : ''}`}
                </Text>
                <Text $size={13} $tone="muted">
                  {`${ROLE_LABELS[m.role]}${m.isOwner ? ' · создатель' : ''}`}
                </Text>
              </Row>
            </Pressable>
          )
        })}
      </View>

      {data?.me.isOwner && data.members.length < MAX_FAMILY_MEMBERS && <MenuLink to="/family/invite">Пригласить</MenuLink>}
      {data?.me.isOwner && data.members.length >= MAX_FAMILY_MEMBERS && (
        <Notice>{`В семье максимум участников (${MAX_FAMILY_MEMBERS}), пригласить ещё кого-то нельзя.`}</Notice>
      )}
      {/* в самом низу, только создателю семьи */}
      {data?.me.isOwner && (
        <Button variant="text" onPress={() => router.push('/family/delete')}>
          Удалить семейный аккаунт
        </Button>
      )}
    </Screen>
  )
}
