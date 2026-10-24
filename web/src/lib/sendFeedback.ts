// Отклик на отправку сообщения: короткий звук и лёгкая вибрация (где устройство умеет). Включается в «Настройках».
const KEY = 'sendSound'

export function isSendSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setSendSoundOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, '0')
  } catch {
    /* хранилища нет — настройка действует до перезагрузки страницы не будет, не страшно */
  }
}

let context: AudioContext | undefined

// Звук рисуется на лету (короткий восходящий «пик»), файлов не нужно; без разрешения браузера на звук тихо ничего не происходит
function blip() {
  const Ctor = window.AudioContext
  if (!Ctor) return
  context ??= new Ctor()
  const ctx = context
  if (ctx.state === 'suspended') void ctx.resume()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const t = ctx.currentTime
  osc.type = 'sine'
  osc.frequency.setValueAtTime(660, t)
  osc.frequency.exponentialRampToValueAtTime(990, t + 0.08)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.15)
}

export function playSendFeedback(): void {
  if (!isSendSoundOn()) return
  try {
    blip()
    navigator.vibrate?.(12)
  } catch {
    /* звук и вибрация не обязательны */
  }
}
