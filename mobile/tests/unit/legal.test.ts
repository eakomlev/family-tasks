import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api'
import { describeSignupError } from '@/features/auth/signupErrors'
import { CONSENT_PATH, legalUrl, OPERATOR_NAME, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal'

describe('политика и согласие', () => {
  it('страницы лежат на сайте: адрес строится от адреса сервера', () => {
    // в тестах адрес сервера https://family.test (vitest.config.ts)
    expect(legalUrl(PRIVACY_PATH)).toBe('https://family.test/privacy')
    expect(legalUrl(CONSENT_PATH)).toBe('https://family.test/privacy#consent')
    expect(legalUrl(TERMS_PATH)).toBe('https://family.test/terms')
  })

  it('оператор назван (реквизиты подставляются перед публикацией)', () => {
    expect(OPERATOR_NAME.length).toBeGreaterThan(0)
  })

  it('сервер потребовал согласие: возврат к данным с понятным текстом', () => {
    expect(describeSignupError(new ApiError(400, 'consent_required'))).toEqual({ text: 'Нужно согласие на обработку персональных данных.', backToDetails: true })
  })
})
