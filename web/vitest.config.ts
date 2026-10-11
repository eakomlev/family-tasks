import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Часовой пояс для всех тестов: даты в приложении считаются по местному времени, результат не должен зависеть от машины.
// Задаётся до запуска воркеров, поэтому они его наследуют.
process.env.TZ = 'Europe/Moscow'

// PWA-плагин из vite.config.ts в тестах не нужен, поэтому конфиг отдельный
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
})
