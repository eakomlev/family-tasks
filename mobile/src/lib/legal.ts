import { Linking } from 'react-native'
import { API_URL } from './config'

// Оператор персональных данных (как в web/src/lib/legal.ts): ЗАМЕНИТЕ на свои реквизиты перед публикацией в обоих местах.
export const OPERATOR_NAME = 'Иван Иванов'

// Политика обработки персональных данных и пользовательское соглашение лежат на сайте (web/src/pages/Privacy и Terms): приложение открывает их в браузере,
// чтобы тексты не дублировались и менялись в одном месте.
export const PRIVACY_PATH = '/privacy'
export const CONSENT_PATH = '/privacy#consent'
export const TERMS_PATH = '/terms'

export const legalUrl = (path: string) => `${API_URL}${path}`

export function openLegal(path: string): void {
  void Linking.openURL(legalUrl(path)).catch(() => {})
}
