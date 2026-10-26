import { useState } from 'react'
import { useRouter } from 'expo-router'
import { ApiError, login, requestCode, type LoginOption } from '@/api'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { toIdentity } from '@/identity/utils'
import { emptyContact, isValidContact, trimContact, type Contact } from '@/lib/contact'
import { describeCodeError, isTooSoon } from '@/lib/errors'
import { ROLE_LABELS } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { CodeStep } from './CodeStep'
import { ContactField } from './ContactField'

type Step = 'contact' | 'code' | 'choose'

// Вход по email или телефону и коду из письма или SMS. Если контакт состоит в нескольких семьях, после кода просим выбрать участника.
export function LoginFlow() {
  const guard = useInFlight()
  const { save } = useIdentity()
  const router = useRouter()
  const [step, setStep] = useState<Step>('contact')
  const [contact, setContact] = useState<Contact>(emptyContact())
  const [code, setCode] = useState('')
  const [options, setOptions] = useState<LoginOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const trimmed = trimContact(contact)
  const sendCode = () => requestCode(trimmed, 'login')

  const handleContact = guard(async () => {
    setBusy(true)
    setError(undefined)
    try {
      await sendCode()
      setStep('code')
    } catch (err) {
      if (isTooSoon(err)) setStep('code')
      else setError(describeCodeError(err))
    } finally {
      setBusy(false)
    }
  })

  const finish = guard(async (enteredCode: string, memberId?: string) => {
    setBusy(true)
    setError(undefined)
    try {
      await save(toIdentity(await login(trimmed, enteredCode, memberId)))
      // сохранённый вход переключает группу экранов сам; на всякий случай уходим на стартовую страницу
      router.replace('/')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'choose_member') {
        // контакт состоит в нескольких семьях: код ещё действителен, просим выбрать
        setCode(enteredCode)
        setOptions((err.body as { options: LoginOption[] }).options)
        setStep('choose')
      } else if (err instanceof ApiError && err.code === 'invalid_code') {
        setError('Неверный код или срок его действия истёк.')
      } else {
        setError('Не удалось войти. Попробуйте ещё раз.')
      }
      setBusy(false)
    }
  })

  if (step === 'code') {
    return (
      <CodeStep
        contact={trimmed}
        busy={busy}
        error={error}
        submitLabel="Войти"
        onSubmit={(c) => finish(c)}
        onResend={sendCode}
        onChangeContact={() => {
          setStep('contact')
          setError(undefined)
        }}
      />
    )
  }

  if (step === 'choose') {
    return (
      <Stack>
        <Text>Эти данные для входа есть в нескольких семьях. В какую войти?</Text>
        {options.map((o) => (
          <Button key={o.id} disabled={busy} onPress={() => finish(code, o.id)}>
            {`${o.name} (${ROLE_LABELS[o.role]})`}
          </Button>
        ))}
        {options.map((o) => (
          <Notice key={`family-${o.id}`}>{`${o.name}: ${o.familyMembers.join(', ')}`}</Notice>
        ))}
        {error && <Notice tone="error">{error}</Notice>}
      </Stack>
    )
  }

  const ready = isValidContact(contact) && !busy

  return (
    <Stack>
      <Text>
        {`Введите ${contact.kind === 'email' ? 'email' : 'номер телефона'}, с которым вы создали семью или присоединились к ней. Мы отправим на него одноразовый код${contact.kind === 'email' ? '.' : ' в SMS.'}`}
      </Text>
      <ContactField contact={contact} onChange={setContact} onSubmitEditing={() => ready && handleContact()} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="primary" disabled={!ready} onPress={handleContact}>
        {busy ? 'Подождите…' : 'Получить код'}
      </Button>
    </Stack>
  )
}
