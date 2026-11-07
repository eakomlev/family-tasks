import { ApiError, get } from './api'

interface SmartCaptcha {
  render(container: HTMLElement, params: Record<string, unknown>): number
  execute(widgetId: number): void
  reset(widgetId: number): void
  subscribe(widgetId: number, event: string, callback: (...args: string[]) => void): () => void
}
declare global { interface Window { smartCaptcha?: SmartCaptcha; __smartCaptchaReady?: () => void } }

const SCRIPT_URL = 'https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload&onload=__smartCaptchaReady'
const HIDDEN_GRACE_MS = 500
let siteKey: Promise<string | null> | undefined
let script: Promise<SmartCaptcha> | undefined
let widget: Promise<number> | undefined
let pending: Promise<string | undefined> | undefined

function loadSiteKey() {
  siteKey ??= get<{ siteKey: string | null }>('/captcha/config', '').then(result => result.siteKey, error => {
    siteKey = undefined
    throw error
  })
  return siteKey
}
function loadScript() {
  script ??= new Promise<SmartCaptcha>((resolve, reject) => {
    const fail = () => {
      script = undefined
      document.querySelector('script[data-smartcaptcha]')?.remove()
      reject(new ApiError(0, 'captcha_unavailable'))
    }
    if (window.smartCaptcha) return resolve(window.smartCaptcha)
    window.__smartCaptchaReady = () => window.smartCaptcha ? resolve(window.smartCaptcha) : fail()
    const el = document.createElement('script')
    el.src = SCRIPT_URL; el.async = true; el.dataset.smartcaptcha = ''; el.onerror = fail
    document.head.append(el)
  })
  return script
}
function ensureWidget(key: string, captcha: SmartCaptcha) {
  widget ??= Promise.resolve().then(() => {
    const container = document.createElement('div'); document.body.append(container)
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
      settled = true; clearTimeout(hiddenTimer); cleanup.forEach(off => off()); done()
    }
    cleanup.push(
      captcha.subscribe(id, 'success', token => finish(() => resolve(token))),
      captcha.subscribe(id, 'challenge-hidden', () => { hiddenTimer = setTimeout(() => finish(() => reject(new ApiError(0, 'captcha_cancelled'))), HIDDEN_GRACE_MS) }),
      captcha.subscribe(id, 'network-error', () => finish(() => reject(new ApiError(0, 'captcha_unavailable')))),
      captcha.subscribe(id, 'javascript-error', () => finish(() => reject(new ApiError(0, 'captcha_unavailable')))),
    )
    captcha.reset(id); captcha.execute(id)
  })
}
export const isCaptchaEnabled = async () => (await loadSiteKey()) !== null
export function getCaptchaToken() {
  pending ??= run().finally(() => { pending = undefined })
  return pending
}
