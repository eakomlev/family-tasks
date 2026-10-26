import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { describeContact } from '@/lib/contact'
import { describeResendError } from '@/lib/errors'
import type { CodeStepProps } from './types'
import { isCompleteCode, RESEND_SECONDS, sanitizeCode } from './utils'

// ввод кода из письма или SMS: общий шаг для регистрации, присоединения и входа
export function CodeStep({ contact, busy, error, submitLabel, onSubmit, onResend, onChangeContact }: CodeStepProps) {
  const byPhone = contact.kind === 'phone'
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(RESEND_SECONDS)
  const [resendError, setResendError] = useState<string>()

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
    setResendError(undefined)
    try {
      await onResend()
      setWait(RESEND_SECONDS)
    } catch (err) {
      setResendError(describeResendError(err))
    }
  }

  return (
    <Stack as="form" onSubmit={handleSubmit}>
      <p>
        {byPhone ? 'Мы отправили SMS с кодом на номер' : 'Мы отправили код на'} <strong>{describeContact(contact)}</strong>. Он действует 10 минут.
        {byPhone && ' SMS может идти до пары минут.'}
      </p>

      <Field label={byPhone ? 'Код из SMS' : 'Код из письма'}>
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
      {resendError && <Notice $tone="error">{resendError}</Notice>}

      <Button $variant="primary" type="submit" disabled={!ready}>
        {busy ? 'Подождите…' : submitLabel}
      </Button>
      <Button type="button" disabled={wait > 0 || busy} onClick={resend}>
        {wait > 0 ? `Отправить код ещё раз (${wait} с)` : 'Отправить код ещё раз'}
      </Button>
      <Button $variant="text" type="button" onClick={onChangeContact}>{byPhone ? 'Изменить номер' : 'Изменить email'}</Button>
    </Stack>
  )
}
