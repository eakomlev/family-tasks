import { isValidEmail } from './validation'

// Способ связи и входа: email (код приходит письмом) или телефон (код приходит SMS). Копия web/src/lib/contact.ts.
export type ContactKind = 'email' | 'phone'

export interface Contact {
  kind: ContactKind
  // как ввёл человек (для телефона нормализуется при отправке)
  value: string
}

export const emptyContact = (kind: ContactKind = 'email'): Contact => ({ kind, value: '' })

// Российский мобильный номер приводится к виду «+79XXXXXXXXX»; прочее null. Правило то же, что на сервере (server/src/contact.ts):
// SMS платные и идут через российского провайдера, городские и зарубежные номера не принимаются.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s()\-.]/g, '')
  const match = /^(?:\+7|8|7)(9\d{9})$/.exec(digits)
  return match ? `+7${match[1]}` : null
}

// Подстановка при вводе номера: цифры раскладываются в «+7 911 123-45-67» по мере набора. Начало «9…», «8…» и «7…» приводится к «+7»,
// «+» и пробелы ставятся сами. Разделителей в конце нет, поэтому стирание с конца идёт по одному символу.
export function formatPhoneInput(input: string): string {
  let digits = input.replace(/\D/g, '')
  if (!digits) return ''
  if (digits[0] === '8') digits = '7' + digits.slice(1)
  else if (digits[0] !== '7') digits = '7' + digits
  digits = digits.slice(0, 11)
  const [a, b, c, d] = [digits.slice(1, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)]
  return ['+7', a, [b, c, d].filter(Boolean).join('-')].filter(Boolean).join(' ')
}

// «+7 911 222-33-44» для показа
export function formatPhone(input: string): string {
  const phone = normalizePhone(input)
  if (!phone) return input.trim()
  return `+7 ${phone.slice(2, 5)} ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
}

export const isValidContact = (contact: Contact) => (contact.kind === 'email' ? isValidEmail(contact.value) : normalizePhone(contact.value) !== null)

// Поле тела запроса: { email } или { phone }
export function contactBody(contact: Contact): { email: string } | { phone: string } {
  return contact.kind === 'email' ? { email: contact.value.trim() } : { phone: normalizePhone(contact.value) ?? contact.value.trim() }
}

// Как показать человеку: адрес или номер в читаемом виде
export const describeContact = (contact: Contact) => (contact.kind === 'email' ? contact.value.trim() : formatPhone(contact.value))

// Без пробелов по краям: так контакт уходит в запросы и показывается на шаге кода
export const trimContact = (contact: Contact): Contact => ({ ...contact, value: contact.value.trim() })
