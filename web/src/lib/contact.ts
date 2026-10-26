import { isValidEmail } from './validation'

// Способ связи и входа: email (код приходит письмом) или телефон (код приходит SMS).
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
