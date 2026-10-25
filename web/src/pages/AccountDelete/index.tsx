import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError, deleteAccount } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { Farewell, Heart, Losses } from '@/pages/FamilyDelete/styles'

function describeAccountDeleteError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
  if (err instanceof ApiError && err.code === 'owner_cannot_delete') return 'Создатель семьи не может удалить только свой аккаунт: можно удалить семью целиком.'
  if (err instanceof ApiError && err.code === 'children_cannot_delete') return 'Аккаунт ребёнка может удалить только создатель семьи, удалив семью целиком.'
  return 'Не удалось удалить аккаунт. Попробуйте ещё раз.'
}

// Удаление своего аккаунта (не ребёнок и не создатель семьи). Объясняем, что исчезнет, и после подтверждения удаляем сразу.
export default function AccountDelete() {
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
    await clear()
  })

  if (!identity) return null
  // ребёнку и создателю семьи страница недоступна; пока профиль не загружен, она не прыгает
  if (data && (data.me.role === 'child' || data.me.isOwner) && !deleted) return <Navigate to="/profile" replace />

  if (deleted) {
    return (
      <Page>
        <Farewell>
          <Heart aria-hidden>💜</Heart>
          <h1>Аккаунт удалён</h1>
          <p>Все ваши данные удалены. Надеемся, мы ещё увидимся!</p>
          <Button $variant="primary" type="button" onClick={goodbye}>
            До встречи!
          </Button>
        </Farewell>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader to="/profile">Удаление аккаунта</PageHeader>
      <p>Вы собираетесь удалить свой аккаунт. Будет удалено без возможности восстановления:</p>
      <Losses>
        <li>ваш профиль, вход и уведомления на всех устройствах, адрес email освободится;</li>
        <li>все ваши личные чаты целиком, вместе с сообщениями собеседников, и ваши сообщения в общем чате;</li>
        <li>фото, видео и файлы, отправленные вами, и чаты созданных вами событий;</li>
        <li>задания, которые вы создали, события календаря и игры с вашим участием.</li>
      </Losses>
      <p>Остальные участники семьи и их данные останутся.</p>
      {error && <Notice $tone="error">{error}</Notice>}
      <Stack>
        <Button $variant="danger" type="button" disabled={busy} onClick={remove}>
          {busy ? 'Удаляем…' : 'Удалить аккаунт'}
        </Button>
      </Stack>
    </Page>
  )
}
