import { View } from 'react-native'
import { Chip } from '@/components/Chip'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import type { Contact, ContactKind } from '@/lib/contact'

interface ContactFieldProps {
  contact: Contact
  onChange: (contact: Contact) => void
  hint?: string
  // false: без переключателя Email или Телефон, показывается поле того вида, что в contact
  switchable?: boolean
  // отправка с клавиатуры
  onSubmitEditing?: () => void
}

const KINDS: { kind: ContactKind; label: string }[] = [
  { kind: 'email', label: 'Email' },
  { kind: 'phone', label: 'Телефон' },
]

// Поле «как с вами связаться»: переключатель Email или Телефон и само поле. Код подтверждения придёт письмом или SMS.
export function ContactField({ contact, onChange, hint, switchable = true, onSubmitEditing }: ContactFieldProps) {
  const set = (kind: ContactKind) => onChange(contact.kind === kind ? contact : { kind, value: '' })

  return (
    <>
      {switchable && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {KINDS.map(({ kind, label }) => (
            <View key={kind} style={{ flex: 1 }}>
              <Chip active={contact.kind === kind} onPress={() => set(kind)}>
                {label}
              </Chip>
            </View>
          ))}
        </View>
      )}
      {contact.kind === 'email' ? (
        <Field label="Email" hint={hint}>
          <Input
            value={contact.value}
            onChangeText={(value) => onChange({ kind: 'email', value })}
            maxLength={254}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="name@example.com"
            onSubmitEditing={onSubmitEditing}
          />
        </Field>
      ) : (
        <Field label="Номер телефона" hint={hint}>
          <Input
            value={contact.value}
            onChangeText={(value) => onChange({ kind: 'phone', value })}
            maxLength={30}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="+7 911 123-45-67"
            onSubmitEditing={onSubmitEditing}
          />
        </Field>
      )}
    </>
  )
}
