import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getPushConfig, subscribePush, unsubscribePush } from '@/api'

// unsupported — браузер не умеет; no-worker — нет service worker (например, в режиме разработки);
// denied — пользователь запретил уведомления; off/on — подписка выключена/включена
export type PushStatus = 'loading' | 'unsupported' | 'no-worker' | 'denied' | 'off' | 'on'

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// applicationServerKey нужен браузеру байтами, а сервер отдаёт ключ в base64url
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function toPayload(subscription: PushSubscription) {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

export function usePushSubscription(token: string) {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // включение и выключение не идут одновременно (двойное нажатие до перерисовки)
  const flying = useRef(false)

  useEffect(() => {
    let cancelled = false
    const set = (value: PushStatus) => !cancelled && setStatus(value)

    async function detect() {
      if (!isPushSupported()) return set('unsupported')
      if (Notification.permission === 'denied') return set('denied')
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) return set('no-worker')

      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return set('off')
      set('on')
      // повторно сообщаем серверу о подписке: так обновляется часовой пояс устройства
      // и подписка восстанавливается, если сервер её потерял
      await subscribePush(token, toPayload(subscription)).catch(() => {})
    }

    detect().catch(() => set('off'))
    return () => { cancelled = true }
  }, [token])

  const enable = useCallback(async () => {
    if (flying.current) return
    flying.current = true
    setBusy(true)
    setError(undefined)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'denied') return setStatus('denied')
      if (permission !== 'granted') return

      const { publicKey } = await getPushConfig()
      const registration = await navigator.serviceWorker.ready
      // подписка, оформленная с другим ключом, мешает новой: убираем её
      await (await registration.pushManager.getSubscription())?.unsubscribe()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      try {
        await subscribePush(token, toPayload(subscription))
      } catch (err) {
        // сервер подписку не принял: в браузере её тоже не оставляем
        await subscription.unsubscribe()
        throw err
      }
      setStatus('on')
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'push_not_configured'
          ? 'Уведомления не настроены на сервере.'
          : 'Не удалось включить уведомления. Попробуйте ещё раз.',
      )
    } finally {
      flying.current = false
      setBusy(false)
    }
  }, [token])

  const disable = useCallback(async () => {
    if (flying.current) return
    flying.current = true
    setBusy(true)
    setError(undefined)
    try {
      const subscription = await currentSubscription()
      if (subscription) {
        await unsubscribePush(token, subscription.endpoint).catch(() => {})
        await subscription.unsubscribe()
      }
      setStatus('off')
    } catch {
      setError('Не удалось выключить уведомления. Попробуйте ещё раз.')
    } finally {
      flying.current = false
      setBusy(false)
    }
  }, [token])

  return { status, busy, error, enable, disable }
}
