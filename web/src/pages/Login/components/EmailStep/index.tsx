import type { FormEvent } from 'react'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { isValidEmail } from '@/lib/validation'
import type { EmailStepProps } from './types'

export function EmailStep({ email, busy, error, onEmailChange, onSubmit }: EmailStepProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isValidEmail(email) && !busy) onSubmit()
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <p>Укажите email, который вы использовали при создании семьи или присоединении. Мы отправим на него код.</p>
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          maxLength={254}
          autoComplete="email"
          placeholder="name@example.com"
        />
      </Field>
      {error && <Notice $tone="error">{error}</Notice>}
      <Button $variant="primary" type="submit" disabled={!isValidEmail(email) || busy}>
        {busy ? 'Подождите…' : 'Получить код'}
      </Button>
    </Stack>
  )
}
