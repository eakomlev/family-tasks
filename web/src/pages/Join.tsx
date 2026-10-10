import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, checkInvite, joinFamily, type SignupData } from '../api'
import { RoleForm } from '../components/RoleForm'
import { ReplaceGuard } from '../components/ReplaceGuard'
import { useIdentity } from '../identityContext'
import { JOIN_ROLES } from '../roles'

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
  const { save } = useIdentity()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<InviteState>('checking')

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

  async function handleSubmit(data: SignupData) {
    const res = await joinFamily(code, data)
    await save({
      familyCode: res.family.code,
      memberId: res.member.id,
      name: res.member.name,
      role: res.member.role,
      token: res.member.token,
    })
    navigate('/family', { replace: true })
  }

  if (invite === 'checking') return <p>Проверяем приглашение…</p>
  if (invite === 'not_found') return <p className="error">Приглашение не найдено. Проверьте ссылку.</p>
  if (invite === 'expired') return <p className="error">Срок приглашения истёк. Попросите прислать новое.</p>
  if (invite === 'error') return <p className="error">Не удалось проверить приглашение. Попробуйте позже.</p>

  return (
    <>
      <p>Вас приглашают в семью.</p>
      <ReplaceGuard>
              <RoleForm roles={JOIN_ROLES} submitLabel="Присоединиться" onSubmit={handleSubmit} />
      </ReplaceGuard>
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
