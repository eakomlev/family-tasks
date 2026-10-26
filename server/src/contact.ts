// Способ связи участника: email или телефон. Вход, регистрация и присоединение работают с любым из двух, а код подтверждения хранится
// под ключом `key` (у email это сам адрес, у телефона «tel:+79…»: ключи не пересекаются).

// Приводит номер к виду «+79XXXXXXXXX». Принимаются только российские мобильные номера: SMS платные и идут через российского провайдера,
// городские и зарубежные номера не нужны и открывали бы дорогую накрутку. Допустимы пробелы, скобки и дефисы, «8» и «7» в начале.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s()\-.]/g, '')
  const match = /^(?:\+7|8|7)(9\d{9})$/.exec(digits)
  return match ? `+7${match[1]}` : null
}

export type Contact =
  | { kind: 'email'; value: string; key: string; column: 'email' }
  | { kind: 'phone'; value: string; key: string; column: 'phone' }

export type ContactResult = { ok: true; contact: Contact } | { ok: false; error: 'contact_required' | 'invalid_phone' }

export const emailContact = (email: string): Contact => {
  const value = email.trim().toLowerCase()
  return { kind: 'email', value, key: value, column: 'email' }
}

export const phoneContact = (phone: string): Contact | null => {
  const value = normalizePhone(phone)
  return value ? { kind: 'phone', value, key: `tel:${value}`, column: 'phone' } : null
}

// Из тела запроса: ровно один из двух, email или phone. Оба сразу или ни одного это ошибка запроса, неверный номер отдельный код.
export function parseContact(body: { email?: string; phone?: string }): ContactResult {
  const hasEmail = body.email !== undefined
  const hasPhone = body.phone !== undefined
  if (hasEmail === hasPhone) return { ok: false, error: 'contact_required' }
  if (hasEmail) return { ok: true, contact: emailContact(body.email as string) }
  const contact = phoneContact(body.phone as string)
  return contact ? { ok: true, contact } : { ok: false, error: 'invalid_phone' }
}
