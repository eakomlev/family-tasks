import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { describeContact, type Contact } from '@/lib/contact'
import { describeResendError } from '@/lib/errors'
import { isCompleteCode, RESEND_SECONDS, RESEND_SMS_SECONDS, sanitizeCode } from './codeUtils'

interface CodeStepProps {
  // куда отправлен код: от этого зависят тексты (письмо или SMS)
  contact: Contact
  busy: boolean
  error?: string
  submitLabel: string
  onSubmit: (code: string) => void
  onResend: () => Promise<unknown>
  onChangeContact: () => void
}

// Ввод кода из письма или SMS: общий шаг для регистрации, присоединения и входа
export function CodeStep({ contact, busy, error, submitLabel, onSubmit, onResend, onChangeContact }: CodeStepProps) {
  const byPhone = contact.kind === 'phone'
  const [code, setCode] = useState('')
  const pause = byPhone ? RESEND_SMS_SECONDS : RESEND_SECONDS
  const [wait, setWait] = useState(pause)
  const [resendError, setResendError] = useState<string>()

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const ready = isCompleteCode(code) && !busy

  async function resend() {
    setResendError(undefined)
    try {
      await onResend()
      setWait(pause)
    } catch (err) {
      setResendError(describeResendError(err))
    }
  }

  return (
    <Stack>
      <Text>
        {byPhone ? 'Мы отправили SMS с кодом на номер ' : 'Мы отправили код на '}
        <Text $weight="extraBold">{describeContact(contact)}</Text>. Он действует 10 минут.{byPhone ? ' SMS может идти до пары минут.' : ''}
      </Text>
      <Field label={byPhone ? 'Код из SMS' : 'Код из письма'}>
        <Input
          value={code}
          onChangeText={(value) => setCode(sanitizeCode(value))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          placeholder="123456"
          autoFocus
          onSubmitEditing={() => ready && onSubmit(code)}
        />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      {resendError && <Notice tone="error">{resendError}</Notice>}
      <Button variant="primary" disabled={!ready} onPress={() => onSubmit(code)}>
        {busy ? 'Подождите…' : submitLabel}
      </Button>
      <Button disabled={wait > 0 || busy} onPress={resend}>
        {wait > 0 ? `Отправить код ещё раз (${wait} с)` : 'Отправить код ещё раз'}
      </Button>
      <Button variant="text" onPress={onChangeContact}>
        {byPhone ? 'Изменить номер' : 'Изменить email'}
      </Button>
    </Stack>
  )
}
