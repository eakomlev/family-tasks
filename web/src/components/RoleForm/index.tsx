import { useState } from 'react'
import { requestCode } from '@/api'
import { CodeStep } from '@/components/CodeStep'
import { describeCodeError, isTooSoon } from '@/lib/errors'
import type { Role } from '@/lib/roles'
import { contactBody, emptyContact, isValidContact, trimContact, type Contact } from '@/lib/contact'
import { DetailsStep } from './components/DetailsStep'
import type { RoleFormProps, Step } from './types'
import { describeSignupError } from './utils'
import { useInFlight } from '@/lib/useInFlight'

// два шага: роль, имя, способ связи (email или телефон) и согласие на обработку персональных данных, затем код из письма или SMS
export function RoleForm({ roles, submitLabel, onSubmit }: RoleFormProps) {
  const guard = useInFlight()
  const [step, setStep] = useState<Step>('details')
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState<Contact>(emptyContact())
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const ready = role !== null && name.trim().length > 0 && isValidContact(contact) && consent && !busy

  const sendCode = () => requestCode(trimContact(contact), 'signup')

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
      await onSubmit({ role, name: name.trim(), ...contactBody(contact), consent: true, code })
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
        contact={trimContact(contact)}
        busy={busy}
        error={error}
        submitLabel={submitLabel}
        onSubmit={handleCode}
        onResend={sendCode}
        onChangeContact={() => { setStep('details'); setError(undefined) }}
      />
    )
  }

  return (
    <DetailsStep
      roles={roles}
      role={role}
      name={name}
      contact={contact}
      consent={consent}
      busy={busy}
      ready={ready}
      error={error}
      onRoleChange={setRole}
      onNameChange={setName}
      onContactChange={setContact}
      onConsentChange={setConsent}
      onSubmit={handleDetails}
    />
  )
}
