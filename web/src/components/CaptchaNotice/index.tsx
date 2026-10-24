import { useEffect, useState } from 'react'
import { isCaptchaEnabled } from '@/lib/captcha'
import { Notice } from './styles'

// Яндекс SmartCaptcha по умолчанию рисует в углу страницы свою плашку. Мы её скрываем (`hideShield`), а вместо неё, как требуют
// условия сервиса, показываем под кнопкой отправки кода короткую строку со ссылками. Есть только когда капча включена на сервере.
export function CaptchaNotice() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    isCaptchaEnabled()
      .then((on) => !cancelled && setEnabled(on))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!enabled) return null
  return (
    <Notice>
      Защищено Yandex SmartCaptcha.{' '}
      <a href="https://yandex.ru/legal/confidential/" target="_blank" rel="noopener noreferrer">
        Политика конфиденциальности
      </a>{' '}
      и{' '}
      <a href="https://yandex.ru/legal/smartcaptcha_agreement/" target="_blank" rel="noopener noreferrer">
        Условия использования
      </a>
      .
    </Notice>
  )
}
