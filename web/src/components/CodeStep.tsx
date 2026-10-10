import { useEffect, useState, type FormEvent } from 'react'

interface Props {
  email: string
  busy: boolean
  error?: string
  submitLabel: string
  onSubmit: (code: string) => void
  onResend: () => Promise<void>
  onChangeEmail: () => void
}

const RESEND_SECONDS = 60

// ввод кода из письма: общий шаг для регистрации, присоединения и входа
export function CodeStep({ email, busy, error, submitLabel, onSubmit, onResend, onChangeEmail }: Props) {
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(RESEND_SECONDS)
  const [resendError, setResendError] = useState(false)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const ready = /^\d{6}$/.test(code) && !busy

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (ready) onSubmit(code)
  }

  async function resend() {
    setResendError(false)
    try {
      await onResend()
      setWait(RESEND_SECONDS)
    } catch {
      setResendError(true)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <p>Мы отправили код на <strong>{email}</strong>. Он действует 10 минут.</p>

      <label className="field">
        Код из письма
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          autoFocus
        />
      </label>

      {error && <p className="error">{error}</p>}
      {resendError && <p className="error">Не удалось отправить код. Попробуйте позже.</p>}

      <button className="btn primary" type="submit" disabled={!ready}>
        {busy ? 'Подождите…' : submitLabel}
      </button>
      <button className="btn" type="button" disabled={wait > 0 || busy} onClick={resend}>
        {wait > 0 ? `Отправить код ещё раз (${wait} с)` : 'Отправить код ещё раз'}
      </button>
      <button className="link-button" type="button" onClick={onChangeEmail}>Изменить email</button>
    </form>
  )
}
