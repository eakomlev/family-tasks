import { expect, it, vi } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}))

// Отдельный файл: перезагрузка модулей мешала бы остальным тестам push.
it('при загрузке модуля библиотеке передаются контакт и оба ключа', async () => {
  // вызов происходит один раз при загрузке модуля, поэтому загружаем его заново
  vi.resetModules()
  await import('../../src/push.js')
  const fresh = (await import('web-push')).default
  expect(fresh.setVapidDetails).toHaveBeenCalledWith('mailto:test@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
})
