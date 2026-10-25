import { useState } from 'react'
import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { ApiError, deleteAccount } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { disablePush } from '@/features/notifications/usePush'
import { useIdentity } from '@/identity/context'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'

function describeAccountDeleteError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
  if (err instanceof ApiError && err.code === 'owner_cannot_delete') return 'Создатель семьи не может удалить только свой аккаунт: можно удалить семью целиком.'
  if (err instanceof ApiError && err.code === 'children_cannot_delete') return 'Аккаунт ребёнка может удалить только создатель семьи, удалив семью целиком.'
  return 'Не удалось удалить аккаунт. Попробуйте ещё раз.'
}

const LOSSES = [
  'ваш профиль, вход и уведомления на всех устройствах, адрес email освободится;',
  'все ваши личные чаты целиком, вместе с сообщениями собеседников, и ваши сообщения в общем чате;',
  'фото, видео и файлы, отправленные вами, и чаты созданных вами событий;',
  'задания, которые вы создали, события календаря и игры с вашим участием.',
]

// Удаление своего аккаунта (не ребёнок и не создатель семьи). Объясняем, что исчезнет, и после подтверждения удаляем сразу.
export function AccountDeleteScreen() {
  const { identity, clear } = useIdentity()
  const { data } = useProfile()
  const guard = useInFlight()
  const confirm = useConfirm()
  const [deleted, setDeleted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const remove = guard(async () => {
    const ok = await confirm({
      title: 'Удалить аккаунт?',
      message: 'Ваш аккаунт, ваши чаты и сообщения будут удалены безвозвратно. Отменить это не получится.',
      confirmLabel: 'Удалить',
      danger: true,
    })
    if (!ok || !identity) return
    setBusy(true)
    setError(undefined)
    try {
      await deleteAccount(identity.token)
      setDeleted(true)
    } catch (err) {
      setError(describeAccountDeleteError(err))
    } finally {
      setBusy(false)
    }
  })

  // сессия на сервере уже удалена вместе с аккаунтом: выходим только на этом устройстве
  const goodbye = guard(async () => {
    if (!identity) return
    await disablePush(identity.token).catch(() => {})
    await clear()
  })

  if (!identity) return null
  // ребёнку и создателю семьи экран недоступен; пока профиль не загружен, он не прыгает
  if (data && (data.me.role === 'child' || data.me.isOwner) && !deleted) return <Redirect href="/profile" />

  if (deleted) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 40 }}>
          <Text $size={64}>💜</Text>
          <Title>Аккаунт удалён</Title>
          <Text style={{ textAlign: 'center' }}>Все ваши данные удалены. Надеемся, мы ещё увидимся!</Text>
          <Button variant="primary" onPress={goodbye}>
            До встречи!
          </Button>
        </View>
      </Screen>
    )
  }

  return (
    <Screen header={<PageHeader fallback="/profile">Удаление аккаунта</PageHeader>}>
      <Text>Вы собираетесь удалить свой аккаунт. Будет удалено без возможности восстановления:</Text>
      <Stack $gap={6}>
        {LOSSES.map((line) => (
          <Text key={line}>{`• ${line}`}</Text>
        ))}
      </Stack>
      <Text>Остальные участники семьи и их данные останутся.</Text>
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="danger" disabled={busy} onPress={remove}>
        {busy ? 'Удаляем…' : 'Удалить аккаунт'}
      </Button>
    </Screen>
  )
}
