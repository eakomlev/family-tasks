import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { describeResendError } from '@/lib/errors'
import { isCompleteCode, RESEND_SECONDS, sanitizeCode } from './codeUtils'

interface CodeStepProps {
  email: string
  busy: boolean
  error?: string
  submitLabel: string
  onSubmit: (code: string) => void
  onResend: () => Promise<unknown>
  onChangeEmail: () => void
}

// Ввод кода из письма: общий шаг для регистрации, присоединения и входа
export function CodeStep({ email, busy, error, submitLabel, onSubmit, onResend, onChangeEmail }: CodeStepProps) {
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(RESEND_SECONDS)
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
      setWait(RESEND_SECONDS)
    } catch (err) {
      setResendError(describeResendError(err))
    }
  }

  return (
    <Stack>
      <Text>
        Мы отправили код на <Text $weight="extraBold">{email}</Text>. Он действует 10 минут.
      </Text>
      <Field label="Код из письма">
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
      <Button variant="text" onPress={onChangeEmail}>
        Изменить email
      </Button>
    </Stack>
  )
}
