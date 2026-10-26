import { useState, type FormEvent } from 'react'
import { useDispatch } from 'react-redux'
import { ApiError, removePhone, requestPhoneCode, savePhone } from '@/api'
import { Button } from '@/components/Button'
import { CodeStep } from '@/components/CodeStep'
import { useConfirm } from '@/components/ConfirmDialog/context'
import { ContactField } from '@/components/ContactField'
import { Notice } from '@/components/Notice'
import { SlideInPage as Page } from '@/components/Page'
import { PageHeader } from '@/components/PageHeader'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { emptyContact, formatPhone, isValidContact, type Contact } from '@/lib/contact'
import { describeCodeError, INVALID_PHONE_TEXT, isTooSoon } from '@/lib/errors'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'

// Телефон для входа: добавить или сменить (код приходит SMS на новый номер), убрать (пока остаётся email)
export default function ProfilePhone() {
  const guard = useInFlight()
  const confirm = useConfirm()
  const dispatch = useDispatch()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const [contact, setContact] = useState<Contact>(emptyContact('phone'))
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (!identity) return null
  const token = identity.token
  const me = data?.me

  const refreshProfile = () => dispatch(api.util.invalidateTags(['Me']))
  const sendCode = () => requestPhoneCode(token, contact.value)

  const handleSend = guard(async () => {
    if (!isValidContact(contact) || busy) return
    setBusy(true)
    setError(undefined)
    try {
      await sendCode()
      setStep('code')
    } catch (err) {
      if (isTooSoon(err)) setStep('code')
      else if (err instanceof ApiError && err.code === 'phone_taken') setError('Этот номер уже есть у другого участника семьи.')
      else if (err instanceof ApiError && err.code === 'invalid_phone') setError(INVALID_PHONE_TEXT)
      else setError(describeCodeError(err))
    } finally {
      setBusy(false)
    }
  })

  const handleCode = guard(async (code: string) => {
    setBusy(true)
    setError(undefined)
    try {
      await savePhone(token, contact.value, code)
      refreshProfile()
      setStep('done')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_code') setError('Неверный код или срок его действия истёк.')
      else if (err instanceof ApiError && err.code === 'phone_taken') setError('Этот номер уже есть у другого участника семьи.')
      else setError('Не удалось сохранить номер. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  })

  const handleRemove = guard(async () => {
    const ok = await confirm({
      title: 'Убрать номер?',
      message: 'Войти по этому номеру больше не получится, останется вход по email.',
      confirmLabel: 'Убрать',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    setError(undefined)
    try {
      await removePhone(token)
      refreshProfile()
    } catch {
      setError('Не удалось убрать номер. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    handleSend()
  }

  return (
    <Page>
      <PageHeader to="/profile">Телефон для входа</PageHeader>

      {step === 'code' && (
        <CodeStep
          contact={{ kind: 'phone', value: contact.value }}
          busy={busy}
          error={error}
          submitLabel="Подтвердить"
          onSubmit={handleCode}
          onResend={sendCode}
          onChangeContact={() => {
            setStep('phone')
            setError(undefined)
          }}
        />
      )}

      {step === 'done' && (
        <Stack>
          <Notice $tone="muted">Готово: войти можно по номеру {formatPhone(contact.value)}.</Notice>
          <Button type="button" onClick={() => setStep('phone')}>Сменить номер</Button>
        </Stack>
      )}

      {step === 'phone' && (
        <Stack as="form" onSubmit={onSubmit}>
          {me?.phone ? <p>Сейчас: <strong>{formatPhone(me.phone)}</strong>. Чтобы сменить номер, введите новый: мы отправим на него SMS с кодом.</p> : <p>Добавьте номер, чтобы входить по SMS-коду. Мы отправим на него SMS с кодом.</p>}
          <ContactField contact={contact} onChange={setContact} switchable={false} />
          {error && <Notice $tone="error">{error}</Notice>}
          <Button $variant="primary" type="submit" disabled={!isValidContact(contact) || busy}>
            {busy ? 'Подождите…' : 'Получить код'}
          </Button>
          {me?.phone && me.email && (
            <Button type="button" disabled={busy} onClick={handleRemove}>Убрать номер</Button>
          )}
        </Stack>
      )}
    </Page>
  )
}
