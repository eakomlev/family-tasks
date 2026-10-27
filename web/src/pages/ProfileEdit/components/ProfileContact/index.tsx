import { useState, type FormEvent } from 'react'
import { ApiError, requestPhoneCode, requestProfileEmailCode, saveEmail, savePhone } from '@/api'
import { Button } from '@/components/Button'
import { CodeStep } from '@/components/CodeStep'
import { ContactField } from '@/components/ContactField'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { emptyContact, formatPhone, isValidContact, normalizePhone, trimContact, type Contact, type ContactKind } from '@/lib/contact'
import { describeCodeError, INVALID_PHONE_TEXT, isTooSoon } from '@/lib/errors'
import { useInFlight } from '@/lib/useInFlight'
import type { ProfileContactProps } from './types'

// Тексты отказов сервера при добавлении способа связи
function describeContactError(err: unknown, kind: ContactKind): string {
  if (err instanceof ApiError) {
    if (err.code === 'phone_taken') return 'Этот номер уже есть у другого участника семьи.'
    if (err.code === 'email_taken') return 'Этот email уже есть у другого участника семьи.'
    if (err.code === 'invalid_phone') return INVALID_PHONE_TEXT
    if (err.code === 'invalid_code') return 'Неверный код или срок его действия истёк.'
    if (err.code === 'contact_locked') return kind === 'phone' ? 'Номер уже указан, менять его нельзя.' : 'Email уже указан, менять его нельзя.'
  }
  return describeCodeError(err)
}

// Способы входа в форме редактирования профиля: указанные email и телефон только для чтения (после подтверждения их не меняют),
// недостающий добавляется тут же: ввод, код из SMS или письма и подтверждение, без отдельных страниц.
export function ProfileContact({ email, phone, token, onSaved }: ProfileContactProps) {
  const guard = useInFlight()
  // что можно добавить: у кого нет номера, номер, у кого нет email, email
  const kind: ContactKind | null = !phone ? 'phone' : !email ? 'email' : null
  const [contact, setContact] = useState<Contact>(emptyContact(kind ?? 'phone'))
  const [step, setStep] = useState<'enter' | 'code'>('enter')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const sendCode = () => {
    const value = trimContact(contact)
    return value.kind === 'phone' ? requestPhoneCode(token, normalizePhone(value.value) ?? value.value) : requestProfileEmailCode(token, value.value)
  }

  const handleSend = guard(async () => {
    if (!isValidContact(contact) || busy) return
    setBusy(true)
    setError(undefined)
    try {
      await sendCode()
      setStep('code')
    } catch (err) {
      if (isTooSoon(err)) setStep('code')
      else setError(describeContactError(err, contact.kind))
    } finally {
      setBusy(false)
    }
  })

  const handleCode = guard(async (code: string) => {
    setBusy(true)
    setError(undefined)
    try {
      const value = trimContact(contact)
      if (value.kind === 'phone') await savePhone(token, normalizePhone(value.value) ?? value.value, code)
      else await saveEmail(token, value.value, code)
      onSaved()
      setStep('enter')
    } catch (err) {
      setError(describeContactError(err, contact.kind))
    } finally {
      setBusy(false)
    }
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void handleSend()
  }

  return (
    <Stack as="section">
      {email && (
        <Field label="Email" hint="Менять нельзя">
          <Input value={email} readOnly disabled />
        </Field>
      )}
      {phone && (
        <Field label="Телефон" hint="Менять нельзя">
          <Input value={formatPhone(phone)} readOnly disabled />
        </Field>
      )}

      {kind && step === 'enter' && (
        <Stack as="form" onSubmit={onSubmit}>
          <p>
            {kind === 'phone'
              ? 'Добавьте номер телефона, чтобы входить и по SMS-коду. Мы отправим на него SMS. После подтверждения изменить номер будет нельзя.'
              : 'Добавьте email, чтобы входить и по коду из письма. Мы отправим на него письмо. После подтверждения изменить email будет нельзя.'}
          </p>
          <ContactField contact={contact} onChange={setContact} switchable={false} />
          {error && <Notice $tone="error">{error}</Notice>}
          <Button $variant="primary" type="submit" disabled={!isValidContact(contact) || busy}>
            {busy ? 'Подождите…' : 'Получить код'}
          </Button>
        </Stack>
      )}

      {kind && step === 'code' && (
        <CodeStep
          contact={trimContact(contact)}
          busy={busy}
          error={error}
          submitLabel="Подтвердить"
          onSubmit={handleCode}
          onResend={sendCode}
          onChangeContact={() => {
            setStep('enter')
            setError(undefined)
          }}
        />
      )}
    </Stack>
  )
}
