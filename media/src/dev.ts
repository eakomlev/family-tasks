// Запуск для разработки: порт из MEDIA_PORT (по умолчанию 3001), без синтаксиса оболочки, чтобы работало и на Windows.
process.env.PORT ??= process.env.MEDIA_PORT || '3001'
await import('./index.js')
