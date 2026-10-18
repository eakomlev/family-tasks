import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { logout } from '@/api'
import { Avatar } from '@/components/Avatar'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { CoinBalanceCard } from '@/components/Coins'
import { useConfirm } from '@/components/ConfirmDialog'
import { MenuLink } from '@/components/MenuLink'
import { Screen } from '@/components/Screen'
import { Heading, Text } from '@/components/Text'
import { disablePush } from '@/features/notifications/usePush'
import { useIdentity } from '@/identity/context'
import { ageFromBirthDate, formatAge, formatBirthDate } from '@/lib/date'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'

// Профиль кратко: фото, имя, роль, дата рождения и email; ниже пункты и «Выйти». Править имя, дату и фото: «Изменить».
export function ProfileScreen() {
  const { identity, clear } = useIdentity()
  const confirm = useConfirm()
  const router = useRouter()
  const { data } = useProfile()

  if (!identity) return null
  const token = identity.token

  async function handleLogout() {
    const ok = await confirm({
      title: 'Выйти из аккаунта?',
      message: 'На этом устройстве вы выйдете из семьи. Вернуться можно, войдя по email.',
      confirmLabel: 'Выйти',
      danger: true,
    })
    if (!ok) return
    // даже если сервер недоступен, на этом устройстве всё равно выходим; уведомления выключаем до выхода, пока токен сессии ещё действует
    await disablePush(token).catch(() => {})
    await logout(token).catch(() => {})
    await clear()
  }

  const me = data?.me

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <BackLink fallback="/" />
        <Heading style={{ flex: 1, fontSize: 22 }}>Профиль</Heading>
        {me && <Button variant="text" onPress={() => router.push('/profile/edit')}>Изменить</Button>}
      </View>
      {!me && <Text $tone="muted">Загрузка…</Text>}
      {me && (
        <>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Avatar name={me.name} seed={me.id} src={me.avatar} size={96} />
            <Heading>{me.name}</Heading>
            <Text $weight="bold" $tone="accent">
              {ROLE_LABELS[me.role]}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            {me.birthDate && <Text $tone="muted">{`${formatBirthDate(me.birthDate)} · ${formatAge(ageFromBirthDate(me.birthDate))}`}</Text>}
            <Text $tone="muted">{me.email}</Text>
          </View>

          {/* у ребёнка: монеты и переход к истории начислений */}
          {me.coins !== undefined && <CoinBalanceCard coins={me.coins} to="/coins" />}

          {me.role === 'child' && (
            <>
              <MenuLink to="/profile/schedule">Расписание уроков</MenuLink>
              <MenuLink to="/profile/trainings">Расписание тренировок</MenuLink>
            </>
          )}
          <MenuLink to="/profile/notifications">Уведомления</MenuLink>
          <MenuLink to="/profile/theme">Тема</MenuLink>
          {me.isAdmin && <MenuLink to="/profile/service">Сервис</MenuLink>}
        </>
      )}

      <Button onPress={handleLogout}>Выйти</Button>
    </Screen>
  )
}
