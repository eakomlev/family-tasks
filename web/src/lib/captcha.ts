import { ApiError, request } from '@/api/client'

// Яндекс SmartCaptcha перед отправкой кода на почту. Виджет невидимый: проверка запускается из кода, когда человек нажал
// «Получить код» (или «Отправить ещё раз»), а если сервис сочтёт его подозрительным, сам покажет задание. Токен одноразовый,
// на каждую отправку запрашивается новый. Без ключей на сервере капчи нет и токен не нужен.

interface SmartCaptcha {
  render(container: HTMLElement, params: Record<string, unknown>): number
  execute(widgetId: number): void
  reset(widgetId: number): void
  subscribe(widgetId: number, event: string, callback: (...args: string[]) => void): () => void
}

declare global {
  interface Window {
    smartCaptcha?: SmartCaptcha
    __smartCaptchaReady?: () => void
  }
}

const SCRIPT_URL = 'https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload&onload=__smartCaptchaReady'
// если окно с заданием закрыли, а токена нет, считаем проверку отменённой (успех приходит чуть раньше или позже закрытия)
const HIDDEN_GRACE_MS = 500

let siteKey: Promise<string | null> | undefined
let script: Promise<SmartCaptcha> | undefined
let widget: Promise<number> | undefined
let pending: Promise<string | undefined> | undefined

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

function loadScript(): Promise<SmartCaptcha> {
  script ??= new Promise<SmartCaptcha>((resolve, reject) => {
    const fail = () => {
      script = undefined
      document.querySelector('script[data-smartcaptcha]')?.remove()
      reject(new ApiError(0, 'captcha_unavailable'))
    }
    if (window.smartCaptcha) return resolve(window.smartCaptcha)
    window.__smartCaptchaReady = () => (window.smartCaptcha ? resolve(window.smartCaptcha) : fail())
    const el = document.createElement('script')
    el.src = SCRIPT_URL
    el.async = true
    el.dataset.smartcaptcha = ''
    el.onerror = fail
    document.head.append(el)
  })
  return script
}

// один невидимый виджет на всё время жизни страницы
function ensureWidget(key: string, captcha: SmartCaptcha): Promise<number> {
  widget ??= Promise.resolve().then(() => {
    const container = document.createElement('div')
    document.body.append(container)
    // hideShield: без плашки в углу страницы, вместо неё строка со ссылками под кнопкой (components/CaptchaNotice)
    return captcha.render(container, { sitekey: key, invisible: true, hideShield: true, hl: 'ru' })
  })
  return widget
}

async function run(): Promise<string | undefined> {
  const key = await loadSiteKey()
  if (!key) return undefined
  const captcha = await loadScript()
  const id = await ensureWidget(key, captcha)

  return new Promise<string>((resolve, reject) => {
    const cleanup: (() => void)[] = []
    let settled = false
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined
    const finish = (done: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(hiddenTimer)
      cleanup.forEach((off) => off())
      done()
    }
    cleanup.push(
      captcha.subscribe(id, 'success', (token) => finish(() => resolve(token))),
      captcha.subscribe(id, 'challenge-hidden', () => {
        hiddenTimer = setTimeout(() => finish(() => reject(new ApiError(0, 'captcha_cancelled'))), HIDDEN_GRACE_MS)
      }),
      captcha.subscribe(id, 'network-error', () => finish(() => reject(new ApiError(0, 'captcha_unavailable')))),
      captcha.subscribe(id, 'javascript-error', () => finish(() => reject(new ApiError(0, 'captcha_unavailable')))),
    )
    captcha.reset(id)
    captcha.execute(id)
  })
}

// Включена ли капча на сервере (нужно, чтобы показать строку со ссылками); сбой запроса бросает ошибку
export async function isCaptchaEnabled(): Promise<boolean> {
  return (await loadSiteKey()) !== null
}

// Токен капчи для запроса кода или undefined, если капча выключена. Одновременные вызовы делят одну проверку.
export function getCaptchaToken(): Promise<string | undefined> {
  pending ??= run().finally(() => {
    pending = undefined
  })
  return pending
}

// только для тестов: забыть загруженное
export function resetCaptcha() {
  siteKey = undefined
  script = undefined
  widget = undefined
  pending = undefined
}
