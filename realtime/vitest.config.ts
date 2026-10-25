import { defineConfig } from 'vitest/config'
import { testDatabaseUrl } from './tests/testDb.js'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    env: { DATABASE_URL: testDatabaseUrl() },
    testTimeout: 15_000,
  },
})
