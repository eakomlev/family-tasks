import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError, logout, requestFamilyDeletion } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { Farewell, Heart, Losses } from './styles'

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'network') return 'Нет связи с сервером. Попробуйте ещё раз.'
  if (err instanceof ApiError && err.status === 403) return 'Удалить семью может только её создатель.'
  return 'Не удалось отправить заявку на удаление. Попробуйте ещё раз.'
}

// Удаление семейного аккаунта (только создатель). Сначала объясняем, что исчезнет, потом оставляем заявку планировщику;
// после неё человек видит прощание, а «До встречи!» выводит его из приложения на стартовую страницу.
export default function FamilyDelete() {
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

  // «До встречи!»: выходим на этом устройстве и попадаем на стартовую страницу (даже если сервер уже не отвечает)
  const goodbye = guard(async () => {
    if (!identity) return
    await logout(identity.token).catch(() => {})
    await clear()
  })

  if (!identity) return null
  // удалять семью может только создатель; пока профиль не загружен, страница не прыгает
  if (data && !data.me.isOwner && !requested) return <Navigate to="/family" replace />

  if (requested) {
    return (
      <Page>
        <Farewell>
          <Heart aria-hidden>💜</Heart>
          <h1>Всё хорошо</h1>
          <p>Заявка принята. Данные вашей семьи будут удалены в ближайшее время.</p>
          <p>Надеемся, мы ещё увидимся!</p>
          <Button $variant="primary" type="button" onClick={goodbye}>
            До встречи!
          </Button>
        </Farewell>
      </Page>
    )
  }

  const count = data?.members.length

  return (
    <Page>
      <BackLink to="/family">← Моя семья</BackLink>
      <h1>Удаление семейного аккаунта</h1>
      <p>Вы собираетесь удалить семью. Будет удалено без возможности восстановления:</p>
      <Losses>
        <li>
          все аккаунты участников семьи{count ? ` (${count})` : ''}: они потеряют доступ, а их адреса email освободятся;
        </li>
        <li>задания, расписания уроков и тренировок, цели и монеты детей;</li>
        <li>события семейного календаря;</li>
        <li>все чаты и сообщения, личные и общий;</li>
        <li>все фото и файлы, отправленные в чатах.</li>
      </Losses>
      <p>Удаление выполняется в течение нескольких минут.</p>
      {error && <Notice $tone="error">{error}</Notice>}
      <Stack>
        <Button $variant="danger" type="button" disabled={busy} onClick={remove}>
          {busy ? 'Отправляем…' : 'Удалить'}
        </Button>
      </Stack>
    </Page>
  )
}
