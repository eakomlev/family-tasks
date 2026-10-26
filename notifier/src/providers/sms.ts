import type { SmsPayload } from '../contract.js'
import type { Outcome } from '../outcome.js'

// Текст SMS с кодом входа. Бесплатная подпись SMS Aero требует, чтобы в тексте был источник (название сервиса), иначе оператор может заблокировать.
export const renderSms = ({ code }: SmsPayload): string => `Моя Семья: код входа ${code}. Никому его не сообщайте`

export interface SmsAeroConfig {
  email: string
  apiKey: string
  // подпись отправителя: по умолчанию бесплатная «SMS Aero»; своя платная подпись согласуется с операторами
  sign: string
  baseUrl?: string
}

// Минимум от fetch, чтобы в тестах подставлять замену.
export type Fetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{ status: number; text(): Promise<string> }>

// Классификация ответа SMS Aero (https://smsaero.ru/integration/documentation/api/): success true это принято (дальше модерация и очередь у
// оператора, доставка занимает от секунд до пары минут). 5xx, сеть, нехватка денег (402), неверный ключ и ограничение по IP временные: после
// пополнения или исправления настроек повтор может пройти. Остальные 4xx (неверный номер, подпись, текст) постоянные.
export function classifySmsAnswer(status: number, body: string): Outcome {
  let parsed: { success?: boolean; message?: string | null; data?: { cost?: number | string } } = {}
  try {
    parsed = JSON.parse(body) as typeof parsed
  } catch {
    // не JSON: ответ прокси или сбой шлюза
  }
  if (status >= 200 && status < 300 && parsed.success === true) {
    // в ответе есть стоимость этого сообщения: по ней считается расход за сутки
    const cost = Number(parsed.data?.cost)
    return Number.isFinite(cost) && cost >= 0 && parsed.data?.cost !== undefined ? { kind: 'sent', cost } : { kind: 'sent' }
  }
  const error = `sms ${status} ${parsed.message ?? body.slice(0, 120)}`.trim()
  if (status === 402 || status === 429 || status === 401 || status === 403 || status >= 500) return { kind: 'retry', error }
  if (status >= 400 && status < 500) return { kind: 'fail', error }
  return { kind: 'retry', error }
}

export function createSmsProvider(config: SmsAeroConfig, fetcher: Fetcher = fetch as unknown as Fetcher) {
  const base = config.baseUrl ?? 'https://gate.smsaero.ru/v2'
  const auth = `Basic ${Buffer.from(`${config.email}:${config.apiKey}`).toString('base64')}`
  return async (payload: SmsPayload): Promise<Outcome> => {
    const query = new URLSearchParams({
      // шлюзу нужны только цифры: 79XXXXXXXXX
      number: payload.to.replace(/\D/g, ''),
      sign: config.sign,
      text: renderSms(payload),
    })
    try {
      const res = await fetcher(`${base}/sms/send?${query}`, { method: 'GET', headers: { authorization: auth }, signal: AbortSignal.timeout(15_000) })
      return classifySmsAnswer(res.status, await res.text())
    } catch (err) {
      return { kind: 'retry', error: `sms network: ${(err as Error).message}` }
    }
  }
}

// Без ключей SMS не отправляются: строки отбрасываются с понятной причиной (как push без ключей VAPID).
export function smsProviderFromEnv(): { enabled: boolean; provider: (payload: SmsPayload) => Promise<Outcome> } {
  const { SMSAERO_EMAIL: email, SMSAERO_API_KEY: apiKey } = process.env
  if (!email || !apiKey) {
    return { enabled: false, provider: async () => ({ kind: 'fail', error: 'sms_not_configured' }) }
  }
  return { enabled: true, provider: createSmsProvider({ email, apiKey, sign: process.env.SMSAERO_SIGN || 'SMS Aero' }) }
}
