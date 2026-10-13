import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // ws: true нужен для живых обновлений (/api/ws)
    // фото из чатов отдаёт сервис media (локально порт 3001, см. npm run dev:media)
    proxy: { '/api': { target: 'http://localhost:3000', ws: true }, '/media': { target: 'http://localhost:3001' } },
  },
  plugins: [
    react(),
    VitePWA({
      // свой service worker (src/sw.ts): кроме кэша приложения он принимает push-уведомления
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        // постоянный идентификатор приложения: смена названия и значка воспринимается как обновление того же приложения
        id: '/',
        name: 'Моя Семья',
        short_name: 'Моя Семья',
        description: 'Задания, расписание, чат и дела всей семьи',
        lang: 'ru',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
