import { useState } from 'react'
import { useIdentity } from '@/identity/context'
import { usePushSubscription } from '@/lib/usePushSubscription'
import { Actions, Bar, Enable, Later } from './styles'
import { isDismissed, rememberDismissed } from './utils'

// Плашка при запуске: уведомления на этом устройстве ещё не включены, предлагаем включить одной кнопкой
// (браузеру нужно нажатие пользователя, поэтому автоматически включить нельзя).
// Не показывается, если браузер не умеет, уведомления запрещены или уже включены; «Позже» прячет её на неделю.
export function PushPrompt() {
  const { identity } = useIdentity()
  if (!identity) return null
  return <Prompt token={identity.token} />
}

function Prompt({ token }: { token: string }) {
  const { status, busy, error, enable } = usePushSubscription(token)
  const [dismissed, setDismissed] = useState(isDismissed)

  if (status !== 'off' || dismissed) return null

  function later() {
    rememberDismissed()
    setDismissed(true)
  }

  return (
    <Bar role="region" aria-label="Уведомления">
      <p>Включите уведомления, чтобы не пропускать задания, сообщения и расписание.</p>
      {error && <small>{error}</small>}
      <Actions>
        <Enable type="button" disabled={busy} onClick={() => void enable()}>
          {busy ? 'Подождите…' : 'Включить уведомления'}
        </Enable>
        <Later type="button" onClick={later}>Позже</Later>
      </Actions>
    </Bar>
  )
}
