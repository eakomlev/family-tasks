import { afterEach, expect, it, vi } from 'vitest'

// Отдельный файл: перезагрузка модуля нужна, потому что признак читается один раз при его загрузке.
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('push включён, когда задан публичный ключ VAPID: серверу приватный ключ не нужен', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'public-key')
  vi.stubEnv('VAPID_PRIVATE_KEY', '')
  vi.resetModules()
  expect((await import('../../src/push.js')).pushEnabled).toBe(true)
})

it('без публичного ключа и FCM push выключен, даже если приватный ключ VAPID задан', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', '')
  vi.stubEnv('FCM_ENABLED', '')
  vi.stubEnv('APNS_ENABLED', '')
  vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key')
  vi.resetModules()
  expect((await import('../../src/push.js')).pushEnabled).toBe(false)
})

it('push на телефон включается признаком FCM_ENABLED независимо от VAPID', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', '')
  vi.stubEnv('FCM_ENABLED', 'true')
  vi.resetModules()
  const push = await import('../../src/push.js')
  expect(push.pushEnabled).toBe(true)
  expect(push.fcmEnabled).toBe(true)
  expect(push.webPushEnabled).toBe(false)
})
