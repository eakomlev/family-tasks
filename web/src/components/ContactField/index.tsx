import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import type { Contact, ContactKind } from '@/lib/contact'
import { Kinds, KindTab } from './styles'
import type { ContactFieldProps } from './types'

const KINDS: { kind: ContactKind; label: string }[] = [
  { kind: 'email', label: 'Email' },
  { kind: 'phone', label: 'Телефон' },
]

// Поле «как с вами связаться»: переключатель Email или Телефон и само поле. Код подтверждения придёт письмом или SMS.
export function ContactField({ contact, onChange, hint, switchable = true }: ContactFieldProps) {
  const set = (kind: ContactKind) => onChange(contact.kind === kind ? contact : ({ kind, value: '' } satisfies Contact))

  return (
    <>
      {switchable && (
        <Kinds role="tablist" aria-label="Способ входа">
          {KINDS.map(({ kind, label }) => (
            <KindTab key={kind} type="button" role="tab" aria-selected={contact.kind === kind} $active={contact.kind === kind} onClick={() => set(kind)}>
              {label}
            </KindTab>
          ))}
        </Kinds>
      )}
      {contact.kind === 'email' ? (
        <Field label="Email" hint={hint}>
          <Input
            type="email"
            value={contact.value}
            onChange={(e) => onChange({ kind: 'email', value: e.target.value })}
            maxLength={254}
            autoComplete="email"
            placeholder="name@example.com"
          />
        </Field>
      ) : (
        <Field label="Номер телефона" hint={hint}>
          <Input
            type="tel"
            value={contact.value}
            onChange={(e) => onChange({ kind: 'phone', value: e.target.value })}
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 911 123-45-67"
          />
        </Field>
      )}
    </>
  )
}
