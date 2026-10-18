import { ApiError, request } from '@/api/client'

// Яндекс SmartCaptcha перед отправкой кода на почту. Проверку выполняет невидимый виджет в WebView (`components/CaptchaHost`):
// она запускается из кода, когда человек нажал «Получить код» (или «Отправить ещё раз»), а если сервис сочтёт его подозрительным,
// сам покажет задание. Токен одноразовый, на каждую отправку запрашивается новый. Без ключей на сервере капчи нет и токен не нужен.

// Исполнитель проверки: показывает WebView с виджетом и возвращает токен; бросает ApiError captcha_cancelled или captcha_unavailable
export type CaptchaRunner = (siteKey: string) => Promise<string>

let runner: CaptchaRunner | undefined
let siteKey: Promise<string | null> | undefined
let pending: Promise<string | undefined> | undefined

// Подключается корневым компонентом `CaptchaHost`
export function registerCaptchaRunner(next: CaptchaRunner | undefined) {
  runner = next
}

// ключ клиента с сервера: пусто, если капча там выключена; успешный ответ запоминается
function loadSiteKey(): Promise<string | null> {
  siteKey ??= request<{ siteKey: string | null }>('/captcha/config').then(
    (res) => res.siteKey,
    (err) => {
      siteKey = undefined
      throw err
    },
  )
  return siteKey
}

async function run(): Promise<string | undefined> {
  const key = await loadSiteKey()
  if (!key) return undefined
  if (!runner) throw new ApiError(0, 'captcha_unavailable')
  return runner(key)
}

// Токен капчи для запроса кода или undefined, если капча выключена. Одновременные вызовы делят одну проверку.
export function getCaptchaToken(): Promise<string | undefined> {
  pending ??= run().finally(() => {
    pending = undefined
  })
  return pending
}

// только для тестов: забыть запомненное
export function resetCaptcha() {
  siteKey = undefined
  pending = undefined
  runner = undefined
}
