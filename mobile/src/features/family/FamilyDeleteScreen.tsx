import { useState } from 'react'
import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { ApiError, logout, requestFamilyDeletion } from '@/api'
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

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
  if (err instanceof ApiError && err.status === 403) return 'Удалить семью может только её создатель.'
  return 'Не удалось отправить заявку на удаление. Попробуйте ещё раз.'
}

// Удаление семейного аккаунта (только создатель). Сначала объясняем, что исчезнет, потом оставляем заявку планировщику;
// после неё человек видит прощание, а «До встречи!» выводит его из приложения на стартовый экран.
export function FamilyDeleteScreen() {
  const { identity, clear } = useIdentity()
  const { data } = useProfile()
  const guard = useInFlight()
  const confirm = useConfirm()
  const [requested, setRequested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const remove = guard(async () => {
    const ok = await confirm({
      title: 'Удалить семейный аккаунт?',
      message: 'Все данные семьи будут удалены безвозвратно. Отменить это не получится.',
      confirmLabel: 'Удалить',
      danger: true,
    })
    if (!ok || !identity) return
    setBusy(true)
    setError(undefined)
    try {
      await requestFamilyDeletion(identity.token)
      setRequested(true)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  })

  // «До встречи!»: выходим на этом устройстве (даже если сервер уже не отвечает)
  const goodbye = guard(async () => {
    if (!identity) return
    await disablePush(identity.token).catch(() => {})
    await logout(identity.token).catch(() => {})
    await clear()
  })

  if (!identity) return null
  // удалять семью может только создатель; пока профиль не загружен, экран не прыгает
  if (data && !data.me.isOwner && !requested) return <Redirect href="/family" />

  if (requested) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 40 }}>
          <Text $size={64}>💜</Text>
          <Title>Всё хорошо</Title>
          <Text style={{ textAlign: 'center' }}>Заявка принята. Данные вашей семьи будут удалены в ближайшее время.</Text>
          <Text style={{ textAlign: 'center' }}>Надеемся, мы ещё увидимся!</Text>
          <Button variant="primary" onPress={goodbye}>
            До встречи!
          </Button>
        </View>
      </Screen>
    )
  }

  const count = data?.members.length
  const losses = [
    `все аккаунты участников семьи${count ? ` (${count})` : ''}: они потеряют доступ, а их адреса email освободятся;`,
    'задания, расписания уроков и тренировок, цели и монеты детей;',
    'события семейного календаря;',
    'все чаты и сообщения, личные и общий;',
    'все фото и файлы, отправленные в чатах.',
  ]

  return (
    <Screen header={<PageHeader fallback="/family/edit">Удаление семейного аккаунта</PageHeader>}>
      <Text>Вы собираетесь удалить семью. Будет удалено без возможности восстановления:</Text>
      <Stack $gap={6}>
        {losses.map((line) => (
          <Text key={line}>{`• ${line}`}</Text>
        ))}
      </Stack>
      <Text>Удаление выполняется в течение нескольких минут.</Text>
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="danger" disabled={busy} onPress={remove}>
        {busy ? 'Отправляем…' : 'Удалить'}
      </Button>
    </Screen>
  )
}
