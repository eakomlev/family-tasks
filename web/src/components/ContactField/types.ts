import type { Contact } from '@/lib/contact'

export interface ContactFieldProps {
  contact: Contact
  onChange: (contact: Contact) => void
  hint?: string
  // false: без переключателя Email или Телефон, показывается поле того вида, что в contact
  switchable?: boolean
}
