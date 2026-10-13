import webpush from 'web-push'
import { defineConfig } from 'vitest/config'
import { testDatabaseUrl } from './tests/testDb.js'

// ключи VAPID на время прогона: настоящие не нужны, но с ними функция push включена
const vapid = webpush.generateVAPIDKeys()

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      VAPID_SUBJECT: 'mailto:test@example.com',
      // письма и push ставятся в очередь outbox (как в проде), отправку проверяет notifier; ветка без очереди: outbox.test.ts
      QUEUE_ENABLED: 'true',
      // в тестах push-сервисом выступает подставной адрес
      PUSH_ALLOWED_HOSTS: 'push.test',
      // администратор в тестах: почта, которую тесты выдают нужному участнику
      ADMIN_EMAILS: 'Boss@Test.Local, other@test.local',
    },
    // файлы тестов работают параллельно, но каждый создаёт свою семью и убирает за собой
    testTimeout: 15_000,
  },
})
