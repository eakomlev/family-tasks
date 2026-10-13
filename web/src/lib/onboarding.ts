const SEEN_KEY = 'onboardingSeen'
const SKIPPED_KEY = 'onboardingSkipped'

// Слайды показываются первый раз; после полного просмотра больше не появляются.
// «Пропустить» прячет их только на время этого сеанса, чтобы в следующий раз человек всё же увидел.
export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== '1' && sessionStorage.getItem(SKIPPED_KEY) !== '1'
  } catch {
    return false
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* хранилище недоступно: слайды покажутся ещё раз, не страшно */
  }
}

export function markOnboardingSkipped() {
  try {
    sessionStorage.setItem(SKIPPED_KEY, '1')
  } catch {
    /* см. выше */
  }
}
