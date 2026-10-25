// Запуск для разработки: порт из REALTIME_PORT (по умолчанию 3002), без синтаксиса оболочки, чтобы работало и на Windows.
process.env.PORT ??= process.env.REALTIME_PORT || '3002'
await import('./index.js')
