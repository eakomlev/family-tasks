import { defineConfig } from 'vitest/config'
import { testDatabaseUrl } from './tests/testDb.js'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      // публичный ключ VAPID нужен серверу только как признак «push включён» и для GET /api/push/config
      VAPID_PUBLIC_KEY: 'test-public-key',
      // push на телефон (токены Firebase): в тестах включён
      FCM_ENABLED: 'true',
      // в тестах push-сервисом выступает подставной адрес
      PUSH_ALLOWED_HOSTS: 'push.test',
      // администратор в тестах: почта, которую тесты выдают нужному участнику
      ADMIN_EMAILS: 'Boss@Test.Local, other@test.local',
    },
    // файлы тестов работают параллельно, но каждый создаёт свою семью и убирает за собой
    testTimeout: 15_000,
  },
})
