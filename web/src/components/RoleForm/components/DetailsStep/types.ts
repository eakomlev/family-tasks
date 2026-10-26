import type { Contact } from '@/lib/contact'
import type { Role } from '@/lib/roles'

export interface DetailsStepProps {
  roles: Role[]
  role: Role | null
  name: string
  contact: Contact
  consent: boolean
  busy: boolean
  ready: boolean
  error?: string
  onRoleChange: (role: Role) => void
  onNameChange: (name: string) => void
  onContactChange: (contact: Contact) => void
  onConsentChange: (consent: boolean) => void
  onSubmit: () => void
}
