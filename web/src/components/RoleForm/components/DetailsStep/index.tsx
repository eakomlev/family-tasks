import type { FormEvent } from 'react'
import { Button } from '@/components/Button'
import { CaptchaNotice } from '@/components/CaptchaNotice'
import { ContactField } from '@/components/ContactField'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { ROLE_LABELS } from '@/lib/roles'
import { RoleCard, Roles } from './styles'
import type { DetailsStepProps } from './types'

export function DetailsStep({
  roles,
  role,
  name,
  contact,
  busy,
  ready,
  error,
  onRoleChange,
  onNameChange,
  onContactChange,
  onSubmit,
}: DetailsStepProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <Roles>
        <legend>Кто вы в семье?</legend>
        {roles.map((r) => (
          <RoleCard key={r} $selected={role === r}>
            <input type="radio" name="role" checked={role === r} onChange={() => onRoleChange(r)} />
            {ROLE_LABELS[r]}
          </RoleCard>
        ))}
      </Roles>

      <Field label="Ваше имя">
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          placeholder="Например, Аня"
        />
      </Field>

      <ContactField
        contact={contact}
        onChange={onContactChange}
        hint="По нему вы будете входить с любого устройства. Ребёнок может указать почту или номер родителя."
      />

      {error && <Notice $tone="error">{error}</Notice>}

      <Button $variant="primary" type="submit" disabled={!ready}>
        {busy ? 'Подождите…' : 'Получить код'}
      </Button>
      <CaptchaNotice />
    </Stack>
  )
}
