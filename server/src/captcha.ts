// Яндекс SmartCaptcha перед отправкой кода на почту. Браузер получает токен у виджета, сервер проверяет его запросом к
// сервису Яндекса и только после этого выпускает код. Без ключей в окружении капча выключена (разработка, тесты).
//
// Токен одноразовый и проверяется до всего остального, не зависит от адреса: ответ по-прежнему ничего не раскрывает про email.

const VALIDATE_URL = 'https://smartcaptcha.cloud.yandex.ru/validate'
const TIMEOUT_MS = 3000

export type CaptchaResult = 'ok' | 'failed' | 'unavailable'

export interface CaptchaVerifier {
  // ключ клиента, его получает браузер для виджета
  siteKey: string
  // unavailable: проверить не удалось (сервис Яндекса не ответил), решает вызывающий
  verify(token: string, ip: string): Promise<CaptchaResult>
}

type Fetch = typeof fetch

export function createCaptchaVerifier(siteKey: string, serverKey: string, fetchImpl: Fetch = fetch): CaptchaVerifier {
  return {
    siteKey,
    async verify(token, ip) {
      try {
        const res = await fetchImpl(VALIDATE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: serverKey, token, ip }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        // 403 (неверный серверный ключ) и 5xx: проверить нельзя, это не «человек не прошёл»
        if (!res.ok) return 'unavailable'
        const body = (await res.json()) as { status?: string }
        return body.status === 'ok' ? 'ok' : 'failed'
      } catch {
        return 'unavailable'
      }
    },
  }
}

// Капча включена, когда заданы оба ключа
export function captchaFromEnv(): CaptchaVerifier | null {
  const siteKey = process.env.SMARTCAPTCHA_CLIENT_KEY?.trim()
  const serverKey = process.env.SMARTCAPTCHA_SERVER_KEY?.trim()
  return siteKey && serverKey ? createCaptchaVerifier(siteKey, serverKey) : null
}
