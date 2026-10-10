import { useState, type FormEvent } from 'react'
import { ApiError, requestEmailCode, type SignupData } from '../api'
import { describeCodeError, isTooSoon } from '../errors'
import { ROLE_LABELS, type Role } from '../roles'
import { CodeStep } from './CodeStep'

interface Props {
  roles: Role[]
  submitLabel: string
  // должен бросить ApiError, если сервер отклонил запрос
  onSubmit: (data: SignupData) => Promise<void>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// два шага: роль, имя и email, затем код из письма
export function RoleForm({ roles, submitLabel, onSubmit }: Props) {
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const trimmedEmail = email.trim()
  const ready = role !== null && name.trim().length > 0 && EMAIL_RE.test(trimmedEmail) && !busy

  async function sendCode() {
    await requestEmailCode(trimmedEmail, 'signup')
  }

  async function handleDetails(e: FormEvent) {
    e.preventDefault()
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
  }

  async function handleCode(code: string) {
    if (!role) return
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit({ role, name: name.trim(), email: trimmedEmail, code })
    } catch (err) {
      const apiError = err instanceof ApiError ? err.code : ''
      if (apiError === 'name_taken') {
        setStep('details')
        setError('В семье уже есть участник с таким именем. Выберите другое.')
      } else if (apiError === 'email_taken') {
        setStep('details')
        setError('Этот email уже используется в семье. Укажите другой.')
      } else if (apiError === 'invalid_code') {
        setError('Неверный код или срок его действия истёк.')
      } else if (apiError === 'invite_expired') {
        setError('Срок приглашения истёк. Попросите прислать новое.')
      } else {
        setError('Не удалось завершить. Попробуйте ещё раз.')
      }
      setBusy(false)
    }
  }

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
    <form onSubmit={handleDetails} className="stack">
      <fieldset className="roles">
        <legend>Кто вы в семье?</legend>
        {roles.map((r) => (
          <label key={r} className={`role-card${role === r ? ' selected' : ''}`}>
            <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} />
            {ROLE_LABELS[r]}
          </label>
        ))}
      </fieldset>

      <label className="field">
        Ваше имя
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          placeholder="Например, Аня"
        />
      </label>

      <label className="field">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          autoComplete="email"
          placeholder="name@example.com"
        />
        <span className="hint">По нему вы будете входить с любого устройства. Ребёнок может указать почту родителя.</span>
      </label>

      {error && <p className="error">{error}</p>}

      <button className="btn primary" type="submit" disabled={!ready}>
        {busy ? 'Подождите…' : 'Получить код'}
      </button>
    </form>
  )
}
