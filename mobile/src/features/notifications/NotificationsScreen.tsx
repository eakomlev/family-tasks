import { useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text, PageTitle } from '@/components/Text'
import { usePush } from './usePush'

// Уведомления на этом телефоне: включить, проверить, выключить. Приходят о заданиях, чатах, монетах, днях рождения, уроках и тренировках.
export function NotificationsScreen() {
  const { state, busy, error, enable, disable, test } = usePush()
  const [sent, setSent] = useState(false)

  return (
    <Screen bottomReserve={88}>
      <BackLink fallback="/profile">← Профиль</BackLink>
      <PageTitle>Уведомления</PageTitle>
      <Text $tone="muted">Сообщения в чате, новые задания, награды, дни рождения, напоминания об уроках и тренировках.</Text>

      {!state && <Text $tone="muted">Загрузка…</Text>}
      {state === 'unsupported' && <Notice>Уведомления в приложении пока работают только на Android.</Notice>}
      {state === 'denied' && <Notice tone="warning">Уведомления запрещены в настройках телефона. Разрешите их для приложения «Моя Семья» и вернитесь сюда.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <Stack>
        {(state === 'off' || state === 'denied') && (
          <Button variant="primary" disabled={busy} onPress={enable}>
            {busy ? 'Подождите…' : 'Включить уведомления'}
          </Button>
        )}
        {state === 'on' && (
          <>
            <Notice>Уведомления на этом телефоне включены.</Notice>
            <Button
              disabled={busy}
              onPress={async () => setSent(await test())}
            >
              Отправить проверочное уведомление
            </Button>
            {sent && <Notice>Отправили: оно придёт в течение минуты.</Notice>}
            <Button variant="text" disabled={busy} onPress={disable}>
              Выключить на этом телефоне
            </Button>
          </>
        )}
      </Stack>
    </Screen>
  )
}
