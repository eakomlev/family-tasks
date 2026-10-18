import { Contact, requestPermissionsAsync } from 'expo-contacts'

export interface PickedContact {
  name: string
  email: string
}

// Выбор контакта из телефона для приглашения: системное окно со списком контактов, у выбранного берём все адреса email.
// Закрытое без выбора окно даёт пустой список; нет доступа к контактам: ошибка `no_permission`.
export async function pickContact(): Promise<PickedContact[]> {
  const permission = await requestPermissionsAsync()
  if (!permission.granted) throw new Error('no_permission')
  const contact = await Contact.presentPicker()
  if (!contact) return []
  const [name, emails] = await Promise.all([contact.getFullName().catch(() => ''), contact.getEmails()])
  return emails.map((e) => ({ name: name.trim(), email: (e.address ?? '').trim() })).filter((c) => c.email !== '')
}
