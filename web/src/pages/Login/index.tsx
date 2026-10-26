import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, login, requestCode, type LoginOption } from '@/api'
import { AppLogo, AuthCard, AuthPage } from '@/components/AuthPage'
import { BackLink } from '@/components/BackLink'
import { CodeStep } from '@/components/CodeStep'
import { ReplaceGuard } from '@/components/ReplaceGuard'
import { useIdentity } from '@/identity/context'
import { toIdentity } from '@/identity/utils'
import { emptyContact, trimContact, type Contact } from '@/lib/contact'
import { describeCodeError, isTooSoon } from '@/lib/errors'
import { ChooseMember } from './components/ChooseMember'
import { ContactStep } from './components/ContactStep'
import type { Step } from './types'
import { START_PATH } from '@/lib/routes'
import { useInFlight } from '@/lib/useInFlight'
import { Header } from './styles'

function LoginFlow() {
  const guard = useInFlight()
  const { save } = useIdentity()
  const navigate = useNavigate()
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
      navigate(START_PATH, { replace: true })
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
        onChangeContact={() => { setStep('contact'); setError(undefined) }}
      />
    )
  }

  if (step === 'choose') {
    return <ChooseMember options={options} busy={busy} error={error} onChoose={(id) => finish(code, id)} />
  }

  return <ContactStep contact={contact} busy={busy} error={error} onContactChange={setContact} onSubmit={handleContact} />
}

export default function Login() {
  return (
    <AuthPage>
      <BackLink to="/">← Назад</BackLink>
      <Header>
        <AppLogo />
        <h1>С возвращением!</h1>
      </Header>
      <ReplaceGuard>
        <AuthCard>
          <LoginFlow />
        </AuthCard>
      </ReplaceGuard>
    </AuthPage>
  )
}
