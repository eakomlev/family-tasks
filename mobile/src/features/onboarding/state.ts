import { getKv } from '@/lib/kv'

const SEEN_KEY = 'onboardingSeen'
// «Пропустить» прячет слайды только на время этого запуска приложения, чтобы в следующий раз человек всё же увидел
let skippedThisRun = false

// Слайды показываются первый раз; после полного просмотра больше не появляются
export function shouldShowOnboarding(): boolean {
  try {
    return getKv().getItem(SEEN_KEY) !== '1' && !skippedThisRun
  } catch {
    return false
  }
}

export function markOnboardingSeen() {
  try {
    getKv().setItem(SEEN_KEY, '1')
  } catch {
    /* хранилище недоступно: слайды покажутся ещё раз, не страшно */
  }
}

export function markOnboardingSkipped() {
  skippedThisRun = true
}

// только для тестов
export function resetOnboardingSkipped() {
  skippedThisRun = false
}
