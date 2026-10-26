import type { FormEvent } from 'react'
import { Button } from '@/components/Button'
import { CaptchaNotice } from '@/components/CaptchaNotice'
import { ContactField } from '@/components/ContactField'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { isValidContact } from '@/lib/contact'
import type { ContactStepProps } from './types'

export function ContactStep({ contact, busy, error, onContactChange, onSubmit }: ContactStepProps) {
  const ready = isValidContact(contact) && !busy

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (ready) onSubmit()
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <p>
        Введите {contact.kind === 'email' ? 'email' : 'номер телефона'}, с которым вы создали семью или присоединились к ней. Мы отправим на него одноразовый код
        {contact.kind === 'email' ? '.' : ' в SMS.'}
      </p>
      <ContactField contact={contact} onChange={onContactChange} />
      {error && <Notice $tone="error">{error}</Notice>}
      <Button $variant="primary" type="submit" disabled={!ready}>
        {busy ? 'Подождите…' : 'Получить код'}
      </Button>
      <CaptchaNotice />
    </Stack>
  )
}
