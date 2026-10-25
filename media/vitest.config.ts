import { defineConfig } from 'vitest/config'

// Тесты работают на настоящем S3-совместимом хранилище (по умолчанию SeaweedFS на localhost:8333, команда запуска в README и в CI) и своём бакете;
// адрес и ключи по умолчанию в tests/s3.ts, их можно переопределить через S3_TEST_ENDPOINT, S3_TEST_ACCESS_KEY, S3_TEST_SECRET_KEY.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // хранилище общее: файлы идут по очереди
    env: { LOG_LEVEL: 'silent' },
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
