import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { ApiError, removePhone, requestPhoneCode, savePhone } from '@/api'
import { Button } from '@/components/Button'
import { useConfirm } from '@/components/ConfirmDialog'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { CodeStep } from '@/features/auth/CodeStep'
import { ContactField } from '@/features/auth/ContactField'
import { useIdentity } from '@/identity/context'
import { emptyContact, formatPhone, isValidContact, type Contact } from '@/lib/contact'
import { describeCodeError, INVALID_PHONE_TEXT, isTooSoon } from '@/lib/errors'
import { useInFlight } from '@/lib/useInFlight'
import { useProfile } from '@/profile/context'
import { api } from '@/store/api'

// Телефон для входа: добавить или сменить (код приходит SMS на новый номер), убрать (пока остаётся email)
export function ProfilePhoneScreen() {
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

  return (
    <Screen header={<PageHeader fallback="/profile">Телефон для входа</PageHeader>}>
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
          <Notice>{`Готово: войти можно по номеру ${formatPhone(contact.value)}.`}</Notice>
          <Button onPress={() => setStep('phone')}>Сменить номер</Button>
        </Stack>
      )}

      {step === 'phone' && (
        <Stack>
          <Text>
            {me?.phone
              ? `Сейчас: ${formatPhone(me.phone)}. Чтобы сменить номер, введите новый: мы отправим на него SMS с кодом.`
              : 'Добавьте номер, чтобы входить по SMS-коду. Мы отправим на него SMS с кодом.'}
          </Text>
          <ContactField contact={contact} onChange={setContact} switchable={false} onSubmitEditing={() => handleSend()} />
          {error && <Notice tone="error">{error}</Notice>}
          <Button variant="primary" disabled={!isValidContact(contact) || busy} onPress={handleSend}>
            {busy ? 'Подождите…' : 'Получить код'}
          </Button>
          {me?.phone && me.email && (
            <Button disabled={busy} onPress={handleRemove}>
              Убрать номер
            </Button>
          )}
        </Stack>
      )}
    </Screen>
  )
}
