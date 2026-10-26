// Повторы: всего 3 попытки, после третьей неудачи строка удаляется.
export const MAX_ATTEMPTS = 3

// Через сколько секунд повторять после неудачной попытки с этим номером (1-я, 2-я).
// Код входа живёт 10 минут, поэтому задержки короткие; push терпит дольше.
const DELAYS: Record<'email' | 'push' | 'sms', number[]> = {
  email: [5, 30],
  push: [60, 600],
  sms: [5, 30],
}

// Не дольше часа: дольше не имеет смысла ждать, а строка всё равно истечёт.
const MAX_RETRY_AFTER_SECONDS = 3600

// random передаётся параметром, чтобы разброс можно было проверить.
export function backoffSeconds(
  channel: 'email' | 'push' | 'sms',
  attempt: number,
  retryAfterSeconds?: number,
  random: () => number = Math.random,
): number {
  const table = DELAYS[channel]
  const base = table[Math.min(Math.max(attempt, 1), table.length) - 1]
  // разброс ±20%, чтобы повторы не приходили одной волной
  const jittered = base * (0.8 + random() * 0.4)
  const asked = Math.min(retryAfterSeconds ?? 0, MAX_RETRY_AFTER_SECONDS)
  return Math.max(jittered, asked)
}

// Retry-After бывает числом секунд или датой.
export function parseRetryAfter(value: unknown, now: Date = new Date()): number | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  if (/^\d+$/.test(text)) return Number(text)
  const at = Date.parse(text)
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now.getTime()) / 1000))
}
