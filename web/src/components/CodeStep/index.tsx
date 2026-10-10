import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import type { CodeStepProps } from './types'
import { isCompleteCode, RESEND_SECONDS, sanitizeCode } from './utils'

// ввод кода из письма: общий шаг для регистрации, присоединения и входа
export function CodeStep({ email, busy, error, submitLabel, onSubmit, onResend, onChangeEmail }: CodeStepProps) {
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(RESEND_SECONDS)
  const [resendError, setResendError] = useState(false)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const ready = isCompleteCode(code) && !busy

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (ready) onSubmit(code)
  }

  async function resend() {
    setResendError(false)
    try {
      await onResend()
      setWait(RESEND_SECONDS)
    } catch {
      setResendError(true)
    }
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <p>Мы отправили код на <strong>{email}</strong>. Он действует 10 минут.</p>

      <Field label="Код из письма">
        <Input
          value={code}
          onChange={(e) => setCode(sanitizeCode(e.target.value))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          autoFocus
        />
      </Field>

      {error && <Notice $tone="error">{error}</Notice>}
      {resendError && <Notice $tone="error">Не удалось отправить код. Попробуйте позже.</Notice>}

      <Button $variant="primary" type="submit" disabled={!ready}>
        {busy ? 'Подождите…' : submitLabel}
      </Button>
      <Button type="button" disabled={wait > 0 || busy} onClick={resend}>
        {wait > 0 ? `Отправить код ещё раз (${wait} с)` : 'Отправить код ещё раз'}
      </Button>
      <Button $variant="text" type="button" onClick={onChangeEmail}>Изменить email</Button>
    </Stack>
  )
}
