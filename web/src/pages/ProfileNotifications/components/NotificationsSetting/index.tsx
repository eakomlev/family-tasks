import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Switch } from '@/components/Switch'
import { usePushSubscription } from '@/lib/usePushSubscription'
import type { NotificationsSettingProps } from './types'
import { STATUS_HINTS } from './utils'

// Уведомления на этом устройстве: переключатель включает и выключает их полностью
export function NotificationsSetting({ token }: NotificationsSettingProps) {
  const { status, busy, error, enable, disable } = usePushSubscription(token)

  const hint = STATUS_HINTS[status]
  // переключать можно, только если браузер умеет и не запрещено: в остальных состояниях объясняет подсказка ниже
  const available = status === 'on' || status === 'off'

  return (
    <Stack as="section">
      <Switch checked={status === 'on'} disabled={!available || busy} onChange={(e) => void (e.target.checked ? enable() : disable())}>
        Уведомления
      </Switch>
      {hint && <Notice $tone="muted">{hint}</Notice>}
      {error && <Notice $tone="error">{error}</Notice>}
    </Stack>
  )
}
