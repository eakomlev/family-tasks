// Проверка контейнера: отвечает ли сервис и доступно ли хранилище (GET /health).
const port = process.env.PORT || '3000'
try {
  const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(4000) })
  process.exitCode = res.ok ? 0 : 1
} catch {
  process.exitCode = 1
}
