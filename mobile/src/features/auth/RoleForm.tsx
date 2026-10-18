import { useState } from 'react'
import { Pressable } from 'react-native'
import styled from 'styled-components/native'
import { requestEmailCode, type SignupData } from '@/api'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { describeCodeError, isTooSoon } from '@/lib/errors'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { isValidEmail } from '@/lib/validation'
import { CodeStep } from './CodeStep'
import { describeSignupError } from './signupErrors'

interface RoleFormProps {
  roles: Role[]
  submitLabel: string
  // адрес, который уже известен (из письма-приглашения): поле заполнено, его можно поправить
  initialEmail?: string
  // должен бросить ApiError, если сервер отклонил запрос
  onSubmit: (data: SignupData) => Promise<void>
}

const RoleCard = styled(Pressable)<{ $selected: boolean }>`
  padding: 14px 16px;
  border-radius: 16px;
  border-width: 2px;
  border-color: ${({ theme, $selected }) => ($selected ? theme.colors.accent : theme.colors.border)};
  background-color: ${({ theme, $selected }) => ($selected ? theme.colors.accentSoft : theme.colors.surface)};
`

// Два шага: роль, имя и email, затем код из письма. Общий для создания семьи и присоединения по приглашению.
export function RoleForm({ roles, submitLabel, initialEmail, onSubmit }: RoleFormProps) {
  const guard = useInFlight()
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const trimmedEmail = email.trim()
  const ready = role !== null && name.trim().length > 0 && isValidEmail(email) && !busy

  const sendCode = () => requestEmailCode(trimmedEmail, 'signup')

  const handleDetails = guard(async () => {
    if (!ready) return
    setBusy(true)
    setError(undefined)
    try {
      await sendCode()
      setStep('code')
    } catch (err) {
      // код уже отправлен меньше минуты назад: просто идём к вводу кода
      if (isTooSoon(err)) setStep('code')
      else setError(describeCodeError(err))
    } finally {
      setBusy(false)
    }
  })

  const handleCode = guard(async (code: string) => {
    if (!role) return
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit({ role, name: name.trim(), email: trimmedEmail, code })
    } catch (err) {
      const { text, backToDetails } = describeSignupError(err)
      if (backToDetails) setStep('details')
      setError(text)
      setBusy(false)
    }
  })

  if (step === 'code') {
    return (
      <CodeStep
        email={trimmedEmail}
        busy={busy}
        error={error}
        submitLabel={submitLabel}
        onSubmit={handleCode}
        onResend={sendCode}
        onChangeEmail={() => {
          setStep('details')
          setError(undefined)
        }}
      />
    )
  }

  return (
    <Stack>
      <Stack $gap={8}>
        <Text $weight="extraBold" $size={14} $tone="muted">
          Кто вы в семье?
        </Text>
        {roles.map((r) => (
          <RoleCard key={r} $selected={role === r} onPress={() => setRole(r)} accessibilityRole="radio" accessibilityState={{ selected: role === r }}>
            <Text $weight="extraBold">{ROLE_LABELS[r]}</Text>
          </RoleCard>
        ))}
      </Stack>

      <Field label="Ваше имя">
        <Input value={name} onChangeText={setName} maxLength={40} autoComplete="given-name" placeholder="Например, Аня" />
      </Field>

      <Field label="Email" hint="По нему вы будете входить с любого устройства. Ребёнок может указать почту родителя.">
        <Input
          value={email}
          onChangeText={setEmail}
          maxLength={254}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="name@example.com"
        />
      </Field>

      {error && <Notice tone="error">{error}</Notice>}

      <Button variant="primary" disabled={!ready} onPress={handleDetails}>
        {busy ? 'Подождите…' : 'Получить код'}
      </Button>
    </Stack>
  )
}
