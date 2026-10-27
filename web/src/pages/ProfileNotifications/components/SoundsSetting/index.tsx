import { useState } from 'react'
import { Stack } from '@/components/Stack'
import { Switch } from '@/components/Switch'
import { isGameSoundOn, setGameSoundOn } from '@/lib/gameSound'
import { isSendSoundOn, setSendSoundOn } from '@/lib/sendFeedback'

// Звуки приложения: отправка сообщения и ходы в играх (хранятся на устройстве)
export function SoundsSetting() {
  const [send, setSend] = useState(isSendSoundOn)
  const [game, setGame] = useState(isGameSoundOn)

  return (
    <Stack as="section">
      <h2>Звуки</h2>
      <Switch
        checked={send}
        onChange={(e) => {
          setSend(e.target.checked)
          setSendSoundOn(e.target.checked)
        }}
      >
        Звук и вибрация при отправке сообщения
      </Switch>
      <Switch
        checked={game}
        onChange={(e) => {
          setGame(e.target.checked)
          setGameSoundOn(e.target.checked)
        }}
      >
        Звуки в играх (ходы, взятия, шах)
      </Switch>
    </Stack>
  )
}
