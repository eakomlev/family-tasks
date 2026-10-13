import { createHmac, timingSafeEqual } from 'node:crypto'

// Подпись ссылки на файл: HMAC-SHA256 от «семья/файл/срок». Один подписанный адрес годится для обоих вариантов (thumb и full).
// Тот же алгоритм у server (contracts/media-v1.json содержит контрольный пример для обоих пакетов).
export const MAX_FUTURE_SECONDS = 3 * 24 * 3600

export function sign(secret: string, family: string, id: string, exp: number): string {
  return createHmac('sha256', secret).update(`${family}/${id}/${exp}`).digest('hex')
}

// exp в секундах Unix. Срок не должен быть в прошлом или слишком далеко в будущем (подпись подделать нельзя, но срок ограничиваем).
export function verify(secret: string, family: string, id: string, exp: number, sig: string, nowSeconds: number): boolean {
  if (!Number.isInteger(exp) || exp <= nowSeconds || exp > nowSeconds + MAX_FUTURE_SECONDS) return false
  const expected = Buffer.from(sign(secret, family, id, exp), 'hex')
  let given: Buffer
  try {
    given = Buffer.from(sig, 'hex')
  } catch {
    return false
  }
  return given.length === expected.length && timingSafeEqual(given, expected)
}
