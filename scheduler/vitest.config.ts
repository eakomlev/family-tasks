import { defineConfig } from 'vitest/config'
import { testDatabaseUrl } from './tests/testDb.js'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    env: { DATABASE_URL: testDatabaseUrl() },
    // проходы читают общие таблицы (подписки, outbox), поэтому файлы идут по очереди
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
