import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { logout } from '@/api'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { CoinBalanceCard } from '@/components/Coins'
import { useConfirm } from '@/components/ConfirmDialog'
import { MenuLink } from '@/components/MenuLink'
import { Screen } from '@/components/Screen'
import { Heading, Text } from '@/components/Text'
import { disablePush } from '@/features/notifications/usePush'
import { useIdentity } from '@/identity/context'
import { formatPhone } from '@/lib/contact'
import { openLegal, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal'
import { ageFromBirthDate, formatAge, formatBirthDate } from '@/lib/date'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfile } from '@/profile/context'

// Профиль кратко: фото, имя, роль, дата рождения, email и телефон; ниже пункты и «Выйти». Править имя, дату и фото: «Изменить».
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
      message: 'На этом устройстве вы выйдете из семьи. Вернуться можно, войдя по email или номеру телефона.',
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
    <Screen header={<PageHeader fallback="/" right={me ? <Button variant="text" onPress={() => router.push('/profile/edit')}>Изменить</Button> : undefined}>
        Профиль
      </PageHeader>}>
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
            {me.email && <Text $tone="muted">{me.email}</Text>}
            {me.phone && <Text $tone="muted">{formatPhone(me.phone)}</Text>}
          </View>

          {/* у ребёнка: монеты и переход к истории начислений */}
          {me.coins !== undefined && <CoinBalanceCard coins={me.coins} to="/coins" />}

          {me.role === 'child' && (
            <>
              <MenuLink to="/profile/schedule">Расписание уроков</MenuLink>
              <MenuLink to="/profile/trainings">Расписание тренировок</MenuLink>
            </>
          )}
          <MenuLink to="/profile/notifications" icon="notifications-outline">Уведомления и звуки</MenuLink>
          <MenuLink to="/profile/theme" icon="color-palette-outline">Оформление</MenuLink>
          {me.isAdmin && <MenuLink to="/profile/service">Сервис</MenuLink>}
          {/* ребёнок и создатель семьи свой аккаунт отдельно не удаляют (создатель удаляет семью целиком) */}
          {me.role !== 'child' && !me.isOwner && <MenuLink to="/profile/delete">Удалить аккаунт</MenuLink>}
        </>
      )}

      {/* как на первом экране: серые ссылки мелким текстом */}
      <Text $size={13} $tone="muted" style={{ textAlign: 'center' }}>
        <Text $size={13} $tone="muted" onPress={() => openLegal(PRIVACY_PATH)} accessibilityRole="link" style={{ textDecorationLine: 'underline' }}>
          Политика обработки данных
        </Text>
        {' · '}
        <Text $size={13} $tone="muted" onPress={() => openLegal(TERMS_PATH)} accessibilityRole="link" style={{ textDecorationLine: 'underline' }}>
          Пользовательское соглашение
        </Text>
      </Text>

      <Button variant="danger" onPress={handleLogout}>Выйти</Button>
    </Screen>
  )
}
