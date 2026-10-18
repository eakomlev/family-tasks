import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Часовой пояс для всех тестов: даты в приложении считаются по местному времени, результат не должен зависеть от машины.
process.env.TZ = 'Europe/Moscow'

// Тесты логики идут в Node, без React Native: экраны проверяются на устройстве и позже компонентными тестами
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'react-native': fileURLToPath(new URL('./tests/stubs/react-native.ts', import.meta.url)),
      '@react-native-community/netinfo': fileURLToPath(new URL('./tests/stubs/netinfo.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    restoreMocks: true,
    env: { EXPO_PUBLIC_API_URL: 'https://family.test' },
  },
})
