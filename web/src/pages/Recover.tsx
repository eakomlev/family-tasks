import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, checkRecovery, claimRecovery } from '../api'
import { ReplaceGuard } from '../components/ReplaceGuard'
import { useIdentity } from '../identityContext'
import { ROLE_LABELS, type Role } from '../roles'

type State =
  | { status: 'checking' | 'not_found' | 'expired' | 'error' }
  | { status: 'ok'; name: string; role: Role }

function RecoverWithCode({ code }: { code: string }) {
  const { save } = useIdentity()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'checking' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    checkRecovery(code)
      .then((res) => !cancelled && setState({ status: 'ok', ...res }))
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'recovery_expired') setState({ status: 'expired' })
        else if (err instanceof ApiError && err.status === 404) setState({ status: 'not_found' })
        else setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [code])

  async function handleClaim() {
    setBusy(true)
    setError(false)
    try {
      const res = await claimRecovery(code)
      await save({
        familyCode: res.family.code,
        memberId: res.member.id,
        name: res.member.name,
        role: res.member.role,
        token: res.member.token,
      })
      navigate('/family', { replace: true })
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  switch (state.status) {
    case 'checking': return <p>Проверяем ссылку…</p>
    case 'not_found': return <p className="error">Ссылка не найдена или уже использована.</p>
    case 'expired': return <p className="error">Срок ссылки истёк. Попросите создать новую.</p>
    case 'error': return <p className="error">Не удалось проверить ссылку. Попробуйте позже.</p>
  }

  return (
    <ReplaceGuard>
      <p>Войти как <strong>{state.name}</strong> ({ROLE_LABELS[state.role]})?</p>
      <p className="muted">Вход на других устройствах перестанет работать.</p>
      {error && <p className="error">Не удалось войти. Попробуйте ещё раз.</p>}
      <button className="btn primary" type="button" disabled={busy} onClick={handleClaim}>
        {busy ? 'Подождите…' : 'Войти'}
      </button>
    </ReplaceGuard>
  )
}

export default function Recover() {
  const [params] = useSearchParams()
  const code = params.get('code')

  return (
    <main className="page">
      <Link className="back" to="/">← Назад</Link>
      <h1>Вход на этом устройстве</h1>
      {code ? <RecoverWithCode key={code} code={code} /> : <p className="error">В ссылке нет кода.</p>}
    </main>
  )
}
