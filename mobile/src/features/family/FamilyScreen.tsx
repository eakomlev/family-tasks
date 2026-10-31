import { Pressable, View } from 'react-native'
import { useState } from 'react'
import { Redirect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import styled, { useTheme } from 'styled-components/native'
import { Avatar } from '@/components/Avatar'
import type { FamilyConnectionsData } from '@/api'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { SlidingTabs } from '@/components/SlidingTabs'
import { Heading, Text, Title, TOP_RIGHT_RESERVE } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { MAX_FAMILY_MEMBERS, ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useGetFamilyConnectionsQuery, useSendFamilyConnectionRequestMutation, useDisconnectFamilyMutation } from '@/store/familyConnections'
import { useConfirm } from '@/components/ConfirmDialog'
import { useInFlight } from '@/lib/useInFlight'

const MemberRow = styled(Pressable)`
  min-height: 58px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 7px 0;
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colors.cardBorder};
`

const FamilyMemberCard = styled.View`
  min-height: 68px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 18px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.cardBorder};
  background-color: ${({ theme }) => theme.colors.surface};
`

const CountPill = styled.View`
  min-width: 28px;
  height: 28px;
  padding-horizontal: 8px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`

const IconTile = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`

function membersLabel(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'участников' : last === 1 ? 'участник' : last >= 2 && last <= 4 ? 'участника' : 'участников'
  return `${count} ${word}`
}

function TabLabel({ active, children }: { active: boolean; children: string }) {
  const { colors } = useTheme()
  return <Text $weight="extraBold" $size={14} style={{ color: active ? colors.accentText : colors.muted }}>{children}</Text>
}

// Карточка семьи, видимая всем участникам; управлять связью может только создатель.
function ConnectedFamily({ family, canDisconnect, onDisconnect, onOpenMember }: {
  family: FamilyConnectionsData['connections'][number]
  canDisconnect: boolean
  onDisconnect: () => void
  onOpenMember: (id: string) => void
}) {
  const { colors } = useTheme()
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile><Ionicons name="people-outline" size={24} color={colors.accent} /></IconTile>
        <View style={{ flex: 1, gap: 2 }}>
          <Text $weight="black" $size={18} numberOfLines={1}>{family.surname ? `Семья ${family.surname}` : 'Связанная семья'}</Text>
          <Text $size={13} $tone="muted">{membersLabel(family.members.length)}</Text>
        </View>
        <CountPill><Text $size={13} $weight="black" $tone="accent">{String(family.members.length)}</Text></CountPill>
      </View>
      <View>
        {family.members.map((member) => (
          <MemberRow key={member.id} onPress={() => onOpenMember(member.id)} accessibilityRole="button" accessibilityLabel={`Профиль: ${member.name}`}>
            <Avatar name={member.name} seed={member.id} src={member.avatar} size={40} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text $weight="extraBold">{member.name}</Text>
              <Text $size={13} $tone="muted">{ROLE_LABELS[member.role]}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.muted} />
          </MemberRow>
        ))}
      </View>
      {canDisconnect && <Button variant="text" onPress={onDisconnect} style={{ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 4 }}>Разорвать связь</Button>}
    </Card>
  )
}

function ConnectionsTab() {
  const { identity } = useIdentity()
  const { data: profile } = useProfile()
  const router = useRouter()
  const { colors } = useTheme()
  const connections = useGetFamilyConnectionsQuery()
  const [sendRequest, sending] = useSendFamilyConnectionRequestMutation()
  const [disconnect, disconnecting] = useDisconnectFamilyMutation()
  const [formOpen, setFormOpen] = useState(false)
  const [familyCode, setFamilyCode] = useState('')
  const [surname, setSurname] = useState('')
  const confirm = useConfirm()
  const guard = useInFlight()
  const adult = identity?.role !== 'child'
  const requests = connections.data?.requests ?? []
  const pendingCount = requests.length
  const savedSurname = connections.data?.surname?.trim() ?? ''
  const visibleSurname = savedSurname || surname.trim()

  const submitRequest = guard(async () => {
    await sendRequest({ familyCode: familyCode.trim(), surname: visibleSurname }).unwrap()
    setFamilyCode('')
    setSurname('')
    setFormOpen(false)
  })

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconTile><Ionicons name="git-network-outline" size={25} color={colors.accent} /></IconTile>
        <View style={{ flex: 1, gap: 3 }}>
          <Text $weight="black" $size={17}>Семьи рядом</Text>
          <Text $size={14} $tone="muted">Общайтесь, играйте и планируйте события вместе.</Text>
        </View>
      </Card>

      {connections.isError && !connections.data && <Notice tone="error">Не удалось загрузить связи. Проверьте интернет и попробуйте ещё раз.</Notice>}
      {connections.isLoading && !connections.data && <Text $tone="muted">Загружаем связи…</Text>}

      {connections.data && connections.data.connections.length > 0 && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Heading>Связанные семьи</Heading>
            <Text $size={13} $tone="muted">{String(connections.data.connections.length)}</Text>
          </View>
          {connections.data.connections.map((family) => (
            <ConnectedFamily
              key={family.familyId}
              family={family}
              canDisconnect={!!profile?.me.isOwner}
              onOpenMember={(id) => router.push({ pathname: '/family/[memberId]', params: { memberId: id } })}
              onDisconnect={guard(async () => {
                if (await confirm({ title: 'Разорвать связь?', message: 'Семьи потеряют доступ к общим событиям и играм.', confirmLabel: 'Разорвать', danger: true })) await disconnect(family.familyId).unwrap().catch(() => {})
              })}
            />
          ))}
        </View>
      )}

      {connections.data && connections.data.connections.length === 0 && (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <IconTile><Ionicons name="people-outline" size={25} color={colors.accent} /></IconTile>
          <Text $weight="black" $size={17}>Пока нет связанных семей</Text>
          <Text $size={14} $tone="muted" style={{ textAlign: 'center' }}>Когда семья примет ваш запрос, её участники появятся здесь.</Text>
        </Card>
      )}

      {adult && (
        <>
          <Pressable
            onPress={() => setFormOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: formOpen }}
            style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface }}
          >
            <IconTile><Ionicons name="add" size={26} color={colors.accent} /></IconTile>
            <View style={{ flex: 1, gap: 1 }}>
              <Text $weight="extraBold">Подключить семью</Text>
              <Text $size={13} $tone="muted">Нужен код семьи</Text>
            </View>
            <Ionicons name={formOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
          </Pressable>

          {formOpen && (
            <Card style={{ gap: 14 }}>
              <View style={{ gap: 3 }}>
                <Text $weight="black" $size={18}>Отправить запрос</Text>
                <Text $size={14} $tone="muted">Взрослый из другой семьи должен будет его принять.</Text>
              </View>
              <Field label="Код другой семьи">
                <Input value={familyCode} onChangeText={setFamilyCode} maxLength={32} autoCapitalize="characters" autoCorrect={false} placeholder="Например, A1B2C3" returnKeyType="next" />
              </Field>
              {savedSurname ? (
                <View style={{ gap: 4 }}>
                  <Text $weight="extraBold" $size={14} $tone="muted">Ваша семья будет указана как</Text>
                  <Text $weight="extraBold">{`Семья ${savedSurname}`}</Text>
                </View>
              ) : (
                <Field label="Фамилия вашей семьи" hint="Её увидит семья, которой вы отправляете запрос.">
                  <Input value={surname} onChangeText={setSurname} maxLength={80} autoCapitalize="words" placeholder="Например, Ивановы" returnKeyType="done" />
                </Field>
              )}
              {sending.isError && <Notice tone="error">Не удалось отправить запрос. Проверьте код семьи и попробуйте ещё раз.</Notice>}
              <Button variant="primary" disabled={sending.isLoading || !familyCode.trim() || !visibleSurname} onPress={submitRequest}>
                {sending.isLoading ? 'Отправляем…' : 'Отправить запрос'}
              </Button>
            </Card>
          )}

          <Pressable
            onPress={() => router.push('/family/requests')}
            accessibilityRole="button"
            style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface }}
          >
            <IconTile><Ionicons name="mail-open-outline" size={22} color={colors.accent} /></IconTile>
            <View style={{ flex: 1, gap: 1 }}>
              <Text $weight="extraBold">Запросы</Text>
              <Text $size={13} $tone="muted">Входящие и отправленные</Text>
            </View>
            {pendingCount > 0 && <CountPill><Text $size={13} $weight="black" $tone="accent">{String(pendingCount)}</Text></CountPill>}
            <Ionicons name="chevron-forward" size={19} color={colors.muted} />
          </Pressable>
          {(disconnecting.isError) && <Notice tone="error">Не удалось обновить связь. Попробуйте ещё раз.</Notice>}
        </>
      )}

      {!adult && <Notice>Связанные семьи доступны для просмотра. Отправлять запросы могут только взрослые.</Notice>}
    </View>
  )
}

// Вкладка «Семья»: участники; вкладка «Связи» показывает общие семьи и управление запросами.
export function FamilyScreen() {
  const { identity } = useIdentity()
  const { data, failed } = useProfile()
  const [tab, setTab] = useState<'family' | 'connections'>('family')
  const connections = useGetFamilyConnectionsQuery(undefined, { skip: !identity })
  const router = useRouter()

  if (!identity) return <Redirect href="/welcome" />

  const pendingCount = identity.role === 'child' ? 0 : connections.data?.requests.length ?? 0

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: TOP_RIGHT_RESERVE }}>
        <Title style={{ flex: 1 }}>Ваша семья</Title>
        {data?.me.isOwner && <Button variant="text" onPress={() => router.push('/family/edit')}>Изменить</Button>}
      </View>
      <SlidingTabs
        selected={tab}
        onSelect={(key) => setTab(key as 'family' | 'connections')}
        tabs={[
          { key: 'family', render: (active) => <TabLabel active={active}>Моя семья</TabLabel> },
          { key: 'connections', accessibilityLabel: pendingCount ? `Связи, запросов: ${pendingCount}` : 'Связи', render: (active) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><TabLabel active={active}>Связи</TabLabel>{pendingCount > 0 && <CountPill style={{ minWidth: 22, height: 22, paddingHorizontal: 5 }}><Text $size={11} $weight="black" $tone="accent">{String(pendingCount)}</Text></CountPill>}</View> },
        ]}
      />

      {tab === 'connections' ? <ConnectionsTab /> : <>
        {identity.role !== 'child' && (
          <Card style={{ gap: 8 }}>
            <Text $weight="extraBold" $size={13} $tone="muted">КОД ВАШЕЙ СЕМЬИ</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text $weight="black" $size={22} style={{ letterSpacing: 2 }}>{identity.familyCode}</Text>
              <Text $size={13} $tone="muted">Чтобы вас нашли</Text>
            </View>
          </Card>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Heading>Участники</Heading>
          {data && <Text $size={13} $tone="muted">{`${data.members.length} из ${MAX_FAMILY_MEMBERS}`}</Text>}
        </View>
        {failed && !data && <Notice tone="error">Не удалось загрузить список. Проверьте соединение.</Notice>}
        {!data && !failed && <Text $tone="muted">Загрузка…</Text>}
        <View style={{ gap: 8 }}>
          {data?.members.map((m) => {
            const isMe = m.id === identity.memberId
            return (
              <Pressable key={m.id} accessibilityRole="button" onPress={() => (isMe ? router.push('/profile') : router.push({ pathname: '/family/[memberId]', params: { memberId: m.id } }))}>
              <FamilyMemberCard>
                  <Avatar name={m.name} seed={m.id} src={m.avatar} size={46} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text $weight="extraBold">{`${m.name}${isMe ? ' (вы)' : ''}`}</Text>
                    <Text $size={13} $tone="muted">{`${ROLE_LABELS[m.role]}${m.isOwner ? ' · создатель' : ''}`}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color="transparent" />
              </FamilyMemberCard>
              </Pressable>
            )
          })}
        </View>
        {data?.me.isOwner && data.members.length < MAX_FAMILY_MEMBERS && <MenuLink to="/family/invite">Пригласить участника</MenuLink>}
        {data?.me.isOwner && data.members.length >= MAX_FAMILY_MEMBERS && <Notice>{`В семье максимум участников (${MAX_FAMILY_MEMBERS}), пригласить ещё кого-то нельзя.`}</Notice>}
      </>}
    </Screen>
  )
}
