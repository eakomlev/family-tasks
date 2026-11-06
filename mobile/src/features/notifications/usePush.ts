import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { ApiError, registerDevice, unsubscribePush } from '@/api'
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
  let device: Notifications.DevicePushToken
  try {
    device = await Notifications.getDevicePushTokenAsync()
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    throw new Error(`apns_token:${details}`)
  }
  const token = String(device.data)
  // на Android токен Firebase, на iPhone токен APNs: сервер отправляет каждому своим способом
  try {
    await registerDevice(sessionToken, { token, timeZone: timeZone(), platform: Platform.OS === 'ios' ? 'ios' : 'android' })
  } catch (error) {
    if (error instanceof ApiError) throw error
    const details = error instanceof Error ? error.message : String(error)
    throw new Error(`device_registration:${details}`)
  }
  getKv().setItem(TOKEN_KEY, token)
}

function pushErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'push_not_configured') return 'На сервере не включена регистрация APNs. Проверьте APNS_ENABLED=true в настройках сервера.'
    if (error.code === 'invalid_token') return 'Сервер получил некорректный токен APNs. Проверьте capability Push Notifications у App ID и установите свежую сборку.'
    if (error.status === 401) return 'Сессия устарела. Выйдите из приложения, войдите снова и повторите попытку.'
    if (error.code === 'network') return 'Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.'
    return `Сервер отклонил регистрацию уведомлений (${error.code}, HTTP ${error.status}).`
  }

  const details = error instanceof Error ? error.message : String(error)
  if (details.startsWith('apns_token:')) {
    const cause = details.slice('apns_token:'.length).trim()
    if (/aps-environment|entitlement|remote notification/i.test(cause)) {
      return `iPhone не выдал токен APNs: у сборки нет нужного разрешения. Включите Push Notifications у App ID com.familytasks.mobile и установите новую сборку. (${cause})`
    }
    return `iPhone не выдал токен APNs. Проверьте Push Notifications у App ID com.familytasks.mobile и попробуйте ещё раз. (${cause})`
  }
  if (details.startsWith('device_registration:')) {
    return `Не удалось зарегистрировать устройство на сервере. Проверьте соединение и настройки APNs на сервере. (${details.slice('device_registration:'.length).trim()})`
  }
  return 'Не удалось включить уведомления. Проверьте настройки APNs и соединение, затем попробуйте ещё раз.'
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
    } catch (cause) {
      setError(pushErrorMessage(cause))
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

  return { state, busy, error, enable, disable }
}
