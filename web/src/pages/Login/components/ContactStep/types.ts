import type { Contact } from '@/lib/contact'

export interface ContactStepProps {
  contact: Contact
  busy: boolean
  error?: string
  onContactChange: (contact: Contact) => void
  onSubmit: () => void
}
