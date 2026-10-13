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

it('без публичного ключа push выключен, даже если приватный задан', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', '')
  vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key')
  vi.resetModules()
  expect((await import('../../src/push.js')).pushEnabled).toBe(false)
})
