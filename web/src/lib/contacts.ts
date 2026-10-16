// Выбор контактов телефона (Contact Picker API). Есть в Chrome на Android; на iPhone и компьютерах его нет, там адрес вводят руками.
// Нужен HTTPS и нажатие человека (вызов только из обработчика клика).

interface ContactInfo {
  name?: string[]
  email?: string[]
}

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactInfo[]>
}

const manager = (): ContactsManager | undefined => (navigator as Navigator & { contacts?: ContactsManager }).contacts

export const contactPickerSupported = () => typeof navigator !== 'undefined' && !!manager() && 'ContactsManager' in window

export interface PickedContact {
  name: string
  email: string
}

// Открывает системный список контактов; возвращает адреса выбранных (у контакта может быть несколько, берём каждый).
// Закрытое без выбора окно даёт пустой список, а не ошибку.
export async function pickContacts(): Promise<PickedContact[]> {
  const picker = manager()
  if (!picker) return []
  try {
    const contacts = await picker.select(['name', 'email'], { multiple: true })
    return contacts.flatMap((c) => (c.email ?? []).map((email) => ({ name: c.name?.[0]?.trim() ?? '', email: email.trim() })))
  } catch (err) {
    // человек закрыл окно: выбирать нечего
    if ((err as Error).name === 'AbortError') return []
    throw err
  }
}
