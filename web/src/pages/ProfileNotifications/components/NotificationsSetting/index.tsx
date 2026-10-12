import { useState } from 'react'
import { ApiError, sendTestPush } from '@/api'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { usePushSubscription } from '@/lib/usePushSubscription'
import type { NotificationsSettingProps } from './types'
import { STATUS_HINTS } from './utils'
import { useInFlight } from '@/lib/useInFlight'

export function NotificationsSetting({ token }: NotificationsSettingProps) {
  const guard = useInFlight()
  const { status, busy, error, enable, disable } = usePushSubscription(token)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string>()

  const handleTest = guard(async () => {
    setTesting(true)
    setTestResult(undefined)
    try {
      const { sent, failed } = await sendTestPush(token)
      setTestResult(
        sent > 0
          ? 'Отправили. Уведомление придёт в течение нескольких секунд.'
          : `Не удалось доставить уведомление (ошибок: ${failed}). Попробуйте включить уведомления заново.`,
      )
    } catch (err) {
      setTestResult(
        err instanceof ApiError && err.code === 'no_subscriptions'
          ? 'На сервере нет подписок этого устройства. Выключите и включите уведомления.'
          : 'Не удалось отправить проверочное уведомление.',
      )
    } finally {
      setTesting(false)
    }
  })

  const hint = STATUS_HINTS[status]

  return (
    <Stack as="section">
      <h1>Уведомления</h1>
      {hint && <Notice $tone="muted">{hint}</Notice>}
      {error && <Notice $tone="error">{error}</Notice>}

      {status === 'off' && (
        <Button $variant="primary" type="button" disabled={busy} onClick={enable}>
          {busy ? 'Подождите…' : 'Включить уведомления'}
        </Button>
      )}
      {status === 'on' && (
        <>
          <Button type="button" disabled={testing} onClick={handleTest}>
            {testing ? 'Отправляем…' : 'Проверить уведомление'}
          </Button>
          {testResult && <Notice $tone="muted">{testResult}</Notice>}
          <Button type="button" disabled={busy} onClick={disable}>
            {busy ? 'Подождите…' : 'Выключить уведомления'}
          </Button>
        </>
      )}
    </Stack>
  )
}
