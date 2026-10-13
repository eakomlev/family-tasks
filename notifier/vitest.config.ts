import { defineConfig } from 'vitest/config'
import { testDatabaseUrl } from './tests/testDb.js'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      // в тестах push-сервисом выступает подставной адрес
      PUSH_ALLOWED_HOSTS: 'push.test',
    },
    // тесты очереди работают с общей таблицей outbox: проходы одного файла не должны забирать строки другого
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
