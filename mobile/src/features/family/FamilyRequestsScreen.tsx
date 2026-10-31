import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import styled, { useTheme } from 'styled-components/native'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { useGetFamilyConnectionsQuery, useRespondFamilyConnectionRequestMutation } from '@/store/familyConnections'
import { useInFlight } from '@/lib/useInFlight'
import { useState } from 'react'

const Status = styled.View<{ $outgoing: boolean }>`
  align-self: flex-start;
  flex-direction: row;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border-radius: 999px;
  background-color: ${({ theme, $outgoing }) => ($outgoing ? theme.colors.accentSoft : theme.colors.lime)};
`

const IconTile = styled.View`
  width: 42px;
  height: 42px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`

// Входящие и отправленные запросы вынесены отдельно, чтобы вкладка «Связи» оставалась короткой.
export function FamilyRequestsScreen() {
  const { identity } = useIdentity()
  const connections = useGetFamilyConnectionsQuery()
  const [respond, responding] = useRespondFamilyConnectionRequestMutation()
  const [surname, setSurname] = useState('')
  const { colors } = useTheme()
  const guard = useInFlight()
  const familySurname = connections.data?.surname?.trim() ?? ''
  const requests = connections.data?.requests ?? []
  const incoming = requests.filter((request) => !request.outgoing)

  if (!identity) return <Redirect href="/welcome" />
  if (identity.role === 'child') return <Redirect href="/family" />

  return (
    <Screen header={<PageHeader fallback="/(app)/(tabs)/family" >Запросы</PageHeader>}>
      <Text $tone="muted">Здесь можно принять запрос от другой семьи или проверить статус отправленного.</Text>
      {connections.isLoading && !connections.data && <Text $tone="muted">Загружаем запросы…</Text>}
      {connections.isError && !connections.data && <Notice tone="error">Не удалось загрузить запросы. Проверьте интернет и попробуйте ещё раз.</Notice>}

      {!!incoming.length && !familySurname && (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconTile><Ionicons name="people-outline" size={22} color={colors.accent} /></IconTile>
            <View style={{ flex: 1, gap: 2 }}>
              <Text $weight="black">Укажите фамилию семьи</Text>
              <Text $size={13} $tone="muted">Её увидят участники связанных семей.</Text>
            </View>
          </View>
          <Field label="Фамилия вашей семьи">
            <Input value={surname} onChangeText={setSurname} maxLength={80} autoCapitalize="words" placeholder="Например, Ивановы" />
          </Field>
        </Card>
      )}

      {connections.data && requests.length === 0 && (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <IconTile><Ionicons name="mail-open-outline" size={23} color={colors.accent} /></IconTile>
          <Text $weight="black" $size={17}>Запросов пока нет</Text>
          <Text $size={14} $tone="muted" style={{ textAlign: 'center' }}>Когда другая семья отправит вам запрос или вы отправите свой, они появятся здесь.</Text>
        </Card>
      )}

      {requests.map((request) => (
        <Card key={request.id} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <IconTile><Ionicons name={request.outgoing ? 'paper-plane-outline' : 'people-outline'} size={21} color={colors.accent} /></IconTile>
            <View style={{ flex: 1, gap: 4, paddingTop: 1 }}>
              <Text $weight="black" $size={17}>{request.outgoing ? `Семья ${request.surname ?? request.familyCode}` : `Семья ${request.fromSurname}`}</Text>
              <Text $size={14} $tone="muted">{request.outgoing ? 'Получатель ещё не ответил.' : 'Хочет установить связь с вашей семьёй.'}</Text>
            </View>
          </View>
          <Status $outgoing={request.outgoing}>
            <Ionicons name={request.outgoing ? 'time-outline' : 'mail-unread-outline'} size={14} color={request.outgoing ? colors.accent : colors.onLime} />
            <Text $size={12} $weight="extraBold" style={{ color: request.outgoing ? colors.accent : colors.onLime }}>{request.outgoing ? 'Ожидает ответа' : 'Входящий запрос'}</Text>
          </Status>
          {!request.outgoing && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button variant="primary" disabled={responding.isLoading || (!familySurname && !surname.trim())} onPress={guard(async () => { await respond({ id: request.id, action: 'accept', surname: familySurname || surname.trim() || undefined }).unwrap().catch(() => {}) })}>Принять</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" disabled={responding.isLoading} onPress={guard(async () => { await respond({ id: request.id, action: 'reject' }).unwrap().catch(() => {}) })}>Отклонить</Button>
              </View>
            </View>
          )}
        </Card>
      ))}
      {responding.isError && <Notice tone="error">Не удалось обработать запрос. Проверьте соединение и попробуйте ещё раз.</Notice>}
    </Screen>
  )
}
