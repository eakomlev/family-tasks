import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { registerDevice, sendTestPush, unsubscribePush } from '@/api'
import { useIdentity } from '@/identity/context'
import { getKv } from '@/lib/kv'

// Состояние уведомлений на этом устройстве: `unsupported` (не телефон, например браузер), `denied` (запрещено в настройках
// телефона), `off` (не включены), `on` (включены, токен зарегистрирован на сервере).
export type PushState = 'unsupported' | 'denied' | 'off' | 'on'

const TOKEN_KEY = 'push-device-token'
const DISMISSED_KEY = 'push-prompt-dismissed'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const supported = Platform.OS === 'android' || Platform.OS === 'ios'
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

// Канал уведомлений Android: сообщения с сервера идут в него (channel_id = default)
async function ensureChannel() {
  // каналов уведомлений на iPhone нет
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Уведомления',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  })
}

// Токен устройства и регистрация на сервере: повтор безопасен (обновляет часовой пояс и привязку к участнику)
export async function registerThisDevice(sessionToken: string): Promise<void> {
  await ensureChannel()
  const device = await Notifications.getDevicePushTokenAsync()
  const token = String(device.data)
  // на Android токен Firebase, на iPhone токен APNs: сервер отправляет каждому своим способом
  await registerDevice(sessionToken, { token, timeZone: timeZone(), platform: Platform.OS === 'ios' ? 'ios' : 'android' })
  getKv().setItem(TOKEN_KEY, token)
}

// Включение по нажатию: запрос разрешения (Android 13 и новее, iPhone), затем регистрация
export async function enablePush(sessionToken: string): Promise<PushState> {
  if (!supported) return 'unsupported'
  const permission = await Notifications.requestPermissionsAsync()
  if (!permission.granted) return 'denied'
  await registerThisDevice(sessionToken)
  return 'on'
}

// Выключение на этом устройстве: токен убирается с сервера (сбой сети не мешает выйти или выключить)
export async function disablePush(sessionToken: string): Promise<void> {
  const token = getKv().getItem(TOKEN_KEY)
  getKv().removeItem(TOKEN_KEY)
  if (token) await unsubscribePush(sessionToken, token).catch(() => {})
}

export async function currentPushState(): Promise<PushState> {
  if (!supported) return 'unsupported'
  const permission = await Notifications.getPermissionsAsync()
  if (!permission.granted) return permission.canAskAgain === false ? 'denied' : 'off'
  return getKv().getItem(TOKEN_KEY) ? 'on' : 'off'
}

// Баннер «Включить уведомления» скрыт на неделю после «Позже»
export const isPromptDismissed = (now = Date.now()) => now - Number(getKv().getItem(DISMISSED_KEY) ?? 0) < WEEK_MS
export const dismissPrompt = (now = Date.now()) => getKv().setItem(DISMISSED_KEY, String(now))

// Состояние и действия для экранов. При открытии приложения, если разрешение уже есть, токен тихо регистрируется заново
// (обновляется часовой пояс, подхватывается смена токена).
export function usePush() {
  const { identity } = useIdentity()
  const sessionToken = identity?.token
  const [state, setState] = useState<PushState>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    const next = await currentPushState()
    setState(next)
    return next
  }, [])

  useEffect(() => {
    if (!sessionToken) return
    void (async () => {
      const next = await refresh()
      if (next === 'on') await registerThisDevice(sessionToken).catch(() => {})
    })()
  }, [sessionToken, refresh])

  const enable = useCallback(async () => {
    if (!sessionToken || busy) return
    setBusy(true)
    setError(undefined)
    try {
      setState(await enablePush(sessionToken))
    } catch {
      setError('Не удалось включить уведомления. Проверьте соединение и попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }, [sessionToken, busy])

  const disable = useCallback(async () => {
    if (!sessionToken || busy) return
    setBusy(true)
    try {
      await disablePush(sessionToken)
      setState('off')
    } finally {
      setBusy(false)
    }
  }, [sessionToken, busy])

  const test = useCallback(async () => {
    if (!sessionToken) return false
    setError(undefined)
    try {
      await sendTestPush(sessionToken)
      return true
    } catch {
      setError('Не удалось отправить проверочное уведомление.')
      return false
    }
  }, [sessionToken])

  return { state, busy, error, enable, disable, test }
}
