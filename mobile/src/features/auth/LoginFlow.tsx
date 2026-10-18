import { useState } from 'react'
import { useRouter } from 'expo-router'
import { ApiError, login, requestEmailCode, type LoginOption } from '@/api'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { toIdentity } from '@/identity/utils'
import { describeCodeError, isTooSoon } from '@/lib/errors'
import { ROLE_LABELS } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { isValidEmail } from '@/lib/validation'
import { CodeStep } from './CodeStep'

type Step = 'email' | 'code' | 'choose'

// Вход по email и коду из письма. Если email состоит в нескольких семьях, после кода просим выбрать участника.
export function LoginFlow() {
  const guard = useInFlight()
  const { save } = useIdentity()
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [options, setOptions] = useState<LoginOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const trimmedEmail = email.trim()
  const sendCode = () => requestEmailCode(trimmedEmail, 'login')

  const handleEmail = guard(async () => {
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
      await save(toIdentity(await login(trimmedEmail, enteredCode, memberId)))
      // сохранённый вход переключает группу экранов сам; на всякий случай уходим на стартовую страницу
      router.replace('/')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'choose_member') {
        // email состоит в нескольких семьях: код ещё действителен, просим выбрать
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
        email={trimmedEmail}
        busy={busy}
        error={error}
        submitLabel="Войти"
        onSubmit={(c) => finish(c)}
        onResend={sendCode}
        onChangeEmail={() => {
          setStep('email')
          setError(undefined)
        }}
      />
    )
  }

  if (step === 'choose') {
    return (
      <Stack>
        <Text>Этот email есть в нескольких семьях. В какую войти?</Text>
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

  return (
    <Stack>
      <Text>Введите email, с которым вы создали семью или присоединились к ней. Мы отправим на него одноразовый код.</Text>
      <Field label="Email">
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
          returnKeyType="send"
          onSubmitEditing={() => isValidEmail(email) && !busy && handleEmail()}
        />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="primary" disabled={!isValidEmail(email) || busy} onPress={handleEmail}>
        {busy ? 'Подождите…' : 'Получить код'}
      </Button>
    </Stack>
  )
}
