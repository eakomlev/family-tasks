import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, login, requestEmailCode, type LoginOption } from '../api'
import { CodeStep } from '../components/CodeStep'
import { ReplaceGuard } from '../components/ReplaceGuard'
import { describeCodeError, isTooSoon } from '../errors'
import { useIdentity } from '../identityContext'
import { ROLE_LABELS } from '../roles'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function LoginFlow() {
  const { save } = useIdentity()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'code' | 'choose'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [options, setOptions] = useState<LoginOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const trimmedEmail = email.trim()

  const sendCode = () => requestEmailCode(trimmedEmail, 'login')

  async function handleEmail(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(trimmedEmail) || busy) return
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
  }

  async function finish(code: string, memberId?: string) {
    setBusy(true)
    setError(undefined)
    try {
      const res = await login(trimmedEmail, code, memberId)
      await save({
        familyCode: res.family.code,
        memberId: res.member.id,
        name: res.member.name,
        role: res.member.role,
        token: res.member.token,
      })
      navigate('/family', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'choose_member') {
        // email состоит в нескольких семьях: код ещё действителен, просим выбрать
        setCode(code)
        setOptions((err.body as { options: LoginOption[] }).options)
        setStep('choose')
      } else if (err instanceof ApiError && err.code === 'invalid_code') {
        setError('Неверный код или срок его действия истёк.')
      } else {
        setError('Не удалось войти. Попробуйте ещё раз.')
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
        submitLabel="Войти"
        onSubmit={(c) => finish(c)}
        onResend={sendCode}
        onChangeEmail={() => { setStep('email'); setError(undefined) }}
      />
    )
  }

  if (step === 'choose') {
    return (
      <div className="stack">
        <p>Этот email есть в нескольких семьях. В какую войти?</p>
        {options.map((o) => (
          <button key={o.id} className="btn choice" type="button" disabled={busy} onClick={() => finish(code, o.id)}>
            <strong>{o.name} ({ROLE_LABELS[o.role]})</strong>
            <span className="muted">Семья: {o.familyMembers.join(', ')}</span>
          </button>
        ))}
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleEmail} className="stack">
      <p>Укажите email, который вы использовали при создании семьи или присоединении. Мы отправим на него код.</p>
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
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary" type="submit" disabled={!EMAIL_RE.test(trimmedEmail) || busy}>
        {busy ? 'Подождите…' : 'Получить код'}
      </button>
    </form>
  )
}

export default function Login() {
  return (
    <main className="page">
      <Link className="back" to="/">← Назад</Link>
      <h1>Вход</h1>
      <ReplaceGuard>
        <LoginFlow />
      </ReplaceGuard>
    </main>
  )
}
