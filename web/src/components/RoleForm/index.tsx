import { useState } from 'react'
import { requestEmailCode } from '@/api'
import { CodeStep } from '@/components/CodeStep'
import { describeCodeError, isTooSoon } from '@/lib/errors'
import type { Role } from '@/lib/roles'
import { isValidEmail } from '@/lib/validation'
import { DetailsStep } from './components/DetailsStep'
import type { RoleFormProps, Step } from './types'
import { describeSignupError } from './utils'
import { useInFlight } from '@/lib/useInFlight'

// два шага: роль, имя и email, затем код из письма
export function RoleForm({ roles, submitLabel, onSubmit }: RoleFormProps) {
  const guard = useInFlight()
  const [step, setStep] = useState<Step>('details')
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const trimmedEmail = email.trim()
  const ready = role !== null && name.trim().length > 0 && isValidEmail(email) && !busy

  const sendCode = () => requestEmailCode(trimmedEmail, 'signup')

  const handleDetails = guard(async () => {
    if (!ready) return
    setBusy(true)
    setError(undefined)
    try {
      await sendCode()
      setStep('code')
    } catch (err) {
      // код уже отправлен меньше минуты назад — просто идём к вводу кода
      if (isTooSoon(err)) setStep('code')
      else setError(describeCodeError(err))
    } finally {
      setBusy(false)
    }
  })

  const handleCode = guard(async (code: string) => {
    if (!role) return
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit({ role, name: name.trim(), email: trimmedEmail, code })
    } catch (err) {
      const { text, backToDetails } = describeSignupError(err)
      if (backToDetails) setStep('details')
      setError(text)
      setBusy(false)
    }
  })

  if (step === 'code') {
    return (
      <CodeStep
        email={trimmedEmail}
        busy={busy}
        error={error}
        submitLabel={submitLabel}
        onSubmit={handleCode}
        onResend={sendCode}
        onChangeEmail={() => { setStep('details'); setError(undefined) }}
      />
    )
  }

  return (
    <DetailsStep
      roles={roles}
      role={role}
      name={name}
      email={email}
      busy={busy}
      ready={ready}
      error={error}
      onRoleChange={setRole}
      onNameChange={setName}
      onEmailChange={setEmail}
      onSubmit={handleDetails}
    />
  )
}
