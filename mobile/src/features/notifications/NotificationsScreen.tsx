import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Switch } from '@/components/Switch'
import { Heading, Text } from '@/components/Text'
import { isGameSoundOn, setGameSoundOn } from '@/features/games/gameSound'
import { isSendSoundOn, setSendSoundOn } from '@/lib/sound'
import { usePush } from './usePush'

// Уведомления и звуки. Уведомления на этом телефоне включаются и выключаются полностью одним переключателем (приходят о заданиях, чатах,
// монетах, днях рождения, уроках и тренировках); звуки приложения хранятся на устройстве.
export function NotificationsScreen() {
  const { state, busy, error, enable, disable, test } = usePush()
  const [sent, setSent] = useState(false)
  const [sendSound, setSendSound] = useState(isSendSoundOn)
  const [gameSound, setGameSound] = useState(isGameSoundOn)

  return (
    <Screen header={<PageHeader fallback="/profile">Уведомления и звуки</PageHeader>}>
      <Switch
        checked={state === 'on'}
        disabled={!state || state === 'unsupported' || busy}
        hint="Сообщения в чате, новые задания, награды, дни рождения, напоминания об уроках и тренировках."
        onChange={(on) => void (on ? enable() : disable())}
      >
        Уведомления
      </Switch>

      {!state && <Text $tone="muted">Загрузка…</Text>}
      {state === 'unsupported' && <Notice>Уведомления в приложении пока работают только на Android.</Notice>}
      {state === 'denied' && <Notice tone="warning">Уведомления запрещены в настройках телефона. Разрешите их для приложения «Моя Семья» и вернитесь сюда.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {state === 'on' && (
        <>
          <Button disabled={busy} onPress={async () => setSent(await test())}>
            Отправить проверочное уведомление
          </Button>
          {sent && <Notice>Отправили: оно придёт в течение минуты.</Notice>}
        </>
      )}

      <Heading>Звуки</Heading>
      <Switch
        checked={sendSound}
        onChange={(on) => {
          setSendSound(on)
          setSendSoundOn(on)
        }}
      >
        Звук при отправке сообщения
      </Switch>
      <Switch
        checked={gameSound}
        onChange={(on) => {
          setGameSound(on)
          setGameSoundOn(on)
        }}
      >
        Звуки в играх (ходы, взятия, шах)
      </Switch>
    </Screen>
  )
}
