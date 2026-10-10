import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, checkInvite, joinFamily } from '../api'
import { RoleForm } from '../components/RoleForm'
import { useIdentity } from '../identity'
import { JOIN_ROLES, type Role } from '../roles'

// принимает и полную ссылку, и просто код
function extractCode(input: string): string {
  const value = input.trim()
  try {
    return new URL(value).searchParams.get('code') ?? ''
  } catch {
    return value
  }
}

function EnterCode() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const code = extractCode(value)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (code) navigate(`/join?code=${encodeURIComponent(code)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <p>Вставьте ссылку-приглашение или её код.</p>
      <label className="field">
        Приглашение
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…/join?code=…" />
      </label>
      <button className="btn primary" type="submit" disabled={!code}>Продолжить</button>
    </form>
  )
}

type InviteState = 'checking' | 'ok' | 'not_found' | 'expired' | 'error'

function JoinWithCode({ code }: { code: string }) {
  const { identity, save } = useIdentity()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<InviteState>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    checkInvite(code)
      .then(() => !cancelled && setInvite('ok'))
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'invite_expired') setInvite('expired')
        else if (err instanceof ApiError && err.status === 404) setInvite('not_found')
        else setInvite('error')
      })
    return () => { cancelled = true }
  }, [code])

  async function handleSubmit(role: Role, name: string) {
    setBusy(true)
    setError(undefined)
    try {
      const res = await joinFamily(code, role, name)
      await save({
        familyCode: res.family.code,
        memberId: res.member.id,
        name: res.member.name,
        role: res.member.role,
        token: res.member.token,
      })
      navigate('/family', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'name_taken') setError('В семье уже есть участник с таким именем. Выберите другое.')
      else if (err instanceof ApiError && err.code === 'invite_expired') setInvite('expired')
      else setError('Не удалось присоединиться. Попробуйте ещё раз.')
      setBusy(false)
    }
  }

  if (invite === 'checking') return <p>Проверяем приглашение…</p>
  if (invite === 'not_found') return <p className="error">Приглашение не найдено. Проверьте ссылку.</p>
  if (invite === 'expired') return <p className="error">Срок приглашения истёк. Попросите прислать новое.</p>
  if (invite === 'error') return <p className="error">Не удалось проверить приглашение. Попробуйте позже.</p>

  return (
    <>
      <p>Вас приглашают в семью.</p>
      {identity && (
        <p className="warning">
          Вы уже состоите в семье на этом устройстве. Если присоединитесь, текущий вход будет заменён.
        </p>
      )}
      <RoleForm roles={JOIN_ROLES} submitLabel="Присоединиться" busy={busy} error={error} onSubmit={handleSubmit} />
    </>
  )
}

export default function Join() {
  const [params] = useSearchParams()
  const code = params.get('code')

  return (
    <main className="page">
      <Link className="back" to="/">← Назад</Link>
      <h1>Присоединиться к семье</h1>
      {code ? <JoinWithCode key={code} code={code} /> : <EnterCode />}
    </main>
  )
}
