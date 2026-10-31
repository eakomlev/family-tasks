import { Pressable, TextInput, View } from 'react-native'
import { useState } from 'react'
import { Redirect, useRouter } from 'expo-router'
import styled from 'styled-components/native'
import { Avatar } from '@/components/Avatar'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { Heading, Text, Title, TOP_RIGHT_RESERVE } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { MAX_FAMILY_MEMBERS, ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useGetFamilyConnectionsQuery, useSendFamilyConnectionRequestMutation, useRespondFamilyConnectionRequestMutation, useDisconnectFamilyMutation } from '@/store/familyConnections'
import { useConfirm } from '@/components/ConfirmDialog'
import { useTheme } from 'styled-components/native'
import { useInFlight } from '@/lib/useInFlight'

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
  const [tab, setTab] = useState<'family' | 'connections'>('family')
  const [familyCode, setFamilyCode] = useState('')
  const [surname, setSurname] = useState('')
  const connections = useGetFamilyConnectionsQuery(undefined, { skip: tab !== 'connections' })
  const [sendRequest, sending] = useSendFamilyConnectionRequestMutation()
  const [respond, responding] = useRespondFamilyConnectionRequestMutation()
  const [disconnect, disconnecting] = useDisconnectFamilyMutation()
  const confirm = useConfirm()
  const theme = useTheme()
  const guard = useInFlight()

  if (!identity) return <Redirect href="/welcome" />

  return (
    <Screen>
      {/* справа место занято значком профиля, «Изменить» (только создателю) стоит левее него */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: TOP_RIGHT_RESERVE }}>
        <Title style={{ flex: 1 }}>Ваша семья</Title>
        {data?.me.isOwner && (
          <Button variant="text" onPress={() => router.push('/family/edit')}>
            Изменить
          </Button>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button variant={tab === 'family' ? 'primary' : 'secondary'} onPress={() => setTab('family')}>Моя семья</Button>
        <Button variant={tab === 'connections' ? 'primary' : 'secondary'} onPress={() => setTab('connections')}>Связи</Button>
      </View>
      {tab === 'connections' ? identity.role === 'child' ? <Notice>Связями между семьями могут управлять только взрослые.</Notice> : <>
        <Heading>Связанные семьи</Heading>
        {connections.data?.connections.map((family) => <View key={family.familyId} style={{ gap: 8, padding: 14, borderRadius: 16, backgroundColor: theme.colors.surface }}>
          <Text $weight="extraBold">{family.surname ? `Семья ${family.surname}` : `Семья ${family.code}`}</Text>
          {family.members.map((member) => <Pressable key={member.id} onPress={() => router.push({ pathname: '/family/[memberId]', params: { memberId: member.id } })} accessibilityRole="button"><Text $tone="accent">{`${member.name} · ${ROLE_LABELS[member.role]}`}</Text></Pressable>)}
          {data?.me.isOwner && <Button variant="danger" onPress={guard(async () => {
            if (await confirm({ title: 'Разорвать связь?', message: 'Семья потеряет доступ к общим событиям и играм.', confirmLabel: 'Разорвать', danger: true })) await disconnect(family.familyId).unwrap().catch(() => {})
          })}>Разорвать связь</Button>}
        </View>)}
        <Heading>Запросы</Heading>
        {connections.data?.requests.map((request) => <View key={request.id} style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: theme.colors.surface }}>
          <Text>{request.outgoing ? `Запрос отправлен семье ${request.surname ?? request.familyCode}` : `Запрос от семьи ${request.fromSurname}`}</Text>
          {!request.outgoing && <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button disabled={responding.isLoading || !(surname.trim() || connections.data?.surname)} onPress={guard(async () => { await respond({ id: request.id, action: 'accept', surname: surname.trim() || connections.data?.surname || '' }).unwrap().catch(() => {}) })}>Принять</Button>
            <Button variant="text" disabled={responding.isLoading} onPress={guard(async () => { await respond({ id: request.id, action: 'reject' }).unwrap().catch(() => {}) })}>Отклонить</Button>
          </View>}
        </View>)}
        <Heading>Отправить запрос</Heading>
        <TextInput placeholder="Код семьи" value={familyCode} onChangeText={setFamilyCode} maxLength={32} autoCapitalize="none" style={{ color: theme.colors.text, backgroundColor: theme.colors.surface, padding: 14, borderRadius: 14 }} />
        <TextInput placeholder={connections.data?.surname ?? 'Фамилия вашей семьи'} value={surname} onChangeText={setSurname} maxLength={80} style={{ color: theme.colors.text, backgroundColor: theme.colors.surface, padding: 14, borderRadius: 14 }} />
        <Button variant="primary" disabled={sending.isLoading || !familyCode.trim() || !(surname.trim() || connections.data?.surname)} onPress={guard(async () => { await sendRequest({ familyCode: familyCode.trim(), surname: surname.trim() || connections.data?.surname || '' }).unwrap().catch(() => {}) })}>Отправить запрос</Button>
        {sending.isError && <Notice tone="error">Не удалось отправить запрос. Проверьте код и попробуйте ещё раз.</Notice>}
        {(responding.isError || disconnecting.isError) && <Notice tone="error">Не удалось выполнить действие. Обновите страницу и попробуйте ещё раз.</Notice>}
      </> : <>
      {identity.role !== 'child' && <Text>{`Вы вошли как ${identity.name} (${ROLE_LABELS[identity.role]}).`}</Text>}

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
      </>}
    </Screen>
  )
}
