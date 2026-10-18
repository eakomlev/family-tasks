import { Pressable, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'styled-components/native'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { CoinBalanceCard } from '@/components/Coins'
import { MenuLink } from '@/components/MenuLink'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { ageFromBirthDate, formatAge, formatBirthDate } from '@/lib/date'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'
import { useGetCoinBalanceQuery } from '@/store/coins'

// Баланс монет ребёнка на его странице, для взрослых; нажатие открывает историю начислений
function ChildCoins({ memberId }: { memberId: string }) {
  const { identity } = useIdentity()
  // монеты начислили или забрали: сигнал `members` сбрасывает кэш, баланс обновляется сам
  const { data: coins } = useGetCoinBalanceQuery(memberId, { skip: !identity })
  if (coins === undefined) return null
  return <CoinBalanceCard coins={coins} to={{ pathname: '/coins/[memberId]', params: { memberId } }} />
}

// Краткая карточка другого участника семьи (только просмотр)
export function MemberScreen({ memberId }: { memberId: string }) {
  const { identity } = useIdentity()
  const { data, failed } = useProfile()
  const router = useRouter()
  const { colors } = useTheme()

  // свой профиль открывается на странице профиля
  if (memberId === identity?.memberId) return <Redirect href="/profile" />

  const member = data?.members.find((m) => m.id === memberId)
  // участника нет в семье (например, неверная ссылка)
  if (data && !member) return <Redirect href="/family" />

  return (
    <Screen>
      <BackLink fallback="/family">← Моя семья</BackLink>
      {!member && failed && <Notice tone="error">Не удалось загрузить участника. Проверьте соединение.</Notice>}
      {!member && !failed && <Text $tone="muted">Загрузка…</Text>}
      {member && (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Avatar name={member.name} seed={member.id} src={member.avatar} size={112} />
          <Title style={{ textAlign: 'center' }}>{member.name}</Title>
          <Text $weight="bold" $tone="accent">
            {`${ROLE_LABELS[member.role]}${member.isOwner ? ' · создатель семьи' : ''}`}
          </Text>
          {member.birthDate && <Notice>{`${formatBirthDate(member.birthDate)} · ${formatAge(ageFromBirthDate(member.birthDate))}`}</Notice>}
          <Pressable
            onPress={() => router.push({ pathname: '/chat/[chat]', params: { chat: member.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Написать: ${member.name}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.accent }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#ffffff" />
            <Text $weight="extraBold" style={{ color: '#ffffff' }}>
              Написать
            </Text>
          </Pressable>
        </View>
      )}
      {/* монеты, цели и расписания ребёнка видят взрослые (расписания правят только родители) */}
      {member?.role === 'child' && identity?.role !== 'child' && (
        <>
          <ChildCoins memberId={member.id} />
          <MenuLink to={{ pathname: '/family/[memberId]/goals', params: { memberId: member.id } }}>Цели</MenuLink>
          <MenuLink to={{ pathname: '/family/[memberId]/schedule', params: { memberId: member.id } }}>Расписание уроков</MenuLink>
          <MenuLink to={{ pathname: '/family/[memberId]/trainings', params: { memberId: member.id } }}>Расписание тренировок</MenuLink>
        </>
      )}
    </Screen>
  )
}
