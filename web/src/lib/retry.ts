import { ApiError } from '@/api/client'

// Пауза между повторами чтения, пока нет связи
export const RETRY_DELAY_MS = 2500

// Повторять можно сетевую ошибку (запрос не дошёл) и ответы шлюза, когда сервер перезапускается (502, 503, 504).
// Остальное (401, 404, 500…) ответ сервера, повтор его не изменит.
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  return (err.status === 0 && err.code === 'network') || err.status === 502 || err.status === 503 || err.status === 504
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })
}

// Чтение данных, которое не сдаётся при пропаже связи: экран показывает «Загрузка…» и пробует снова каждые 2–3 секунды.
// Прекращается, когда экран ушёл (signal) или пришёл настоящий ответ с ошибкой.
export async function retryRead<T>(call: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (;;) {
    try {
      return await call()
    } catch (err) {
      if (!isRetryable(err) || signal?.aborted) throw err
      await sleep(RETRY_DELAY_MS, signal)
      if (signal?.aborted) throw err
    }
  }
}
