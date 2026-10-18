import { request, send } from '../client'
import type { PushSubscriptionPayload, PushTestResult } from './types'

export const getPushConfig = () => request<{ publicKey: string }>('/push/config')

export const subscribePush = (token: string, payload: PushSubscriptionPayload) =>
  request<void>('/push/subscriptions', send('POST', payload), token)

export const unsubscribePush = (token: string, endpoint: string) =>
  request<void>('/push/unsubscribe', send('POST', { endpoint }), token)

// Устройство с приложением: токен Firebase и часовой пояс (по нему считаются 10:00 и 17:00); повтор обновляет пояс и привязку к участнику
export const registerDevice = (token: string, payload: { token: string; timeZone: string }) =>
  request<void>('/push/devices', send('POST', payload), token)

// тестовое уведомление на все устройства участника
export const sendTestPush = (token: string) => request<PushTestResult>('/push/test', send('POST'), token)

export type * from './types'
