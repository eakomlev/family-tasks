import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { ROLE_LABELS } from '@/lib/roles'
import { Choice } from './styles'
import type { ChooseMemberProps } from './types'

export function ChooseMember({ options, busy, error, onChoose }: ChooseMemberProps) {
  return (
    <Stack>
      <p>Эти данные для входа есть в нескольких семьях. В какую войти?</p>
      {options.map((o) => (
        <Choice key={o.id} type="button" disabled={busy} onClick={() => onChoose(o.id)}>
          <strong>{o.name} ({ROLE_LABELS[o.role]})</strong>
          <Notice $tone="muted">Семья: {o.familyMembers.join(', ')}</Notice>
        </Choice>
      ))}
      {error && <Notice $tone="error">{error}</Notice>}
    </Stack>
  )
}
