import type { Contact } from '@/lib/contact'

export interface CodeStepProps {
  // куда отправлен код: от этого зависят тексты (письмо или SMS)
  contact: Contact
  busy: boolean
  error?: string
  submitLabel: string
  onSubmit: (code: string) => void
  onResend: () => Promise<void>
  onChangeContact: () => void
}
