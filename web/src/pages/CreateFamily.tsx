import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, createFamily } from '../api'
import { RoleForm } from '../components/RoleForm'
import { useIdentity } from '../identity'
import { CREATOR_ROLES } from '../roles'

export default function CreateFamily() {
  const { save } = useIdentity()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function handleSubmit(role: Parameters<typeof createFamily>[0], name: string) {
    setBusy(true)
    setError(undefined)
    try {
      const res = await createFamily(role, name)
      // токен возвращается один раз, поэтому сохраняем сразу, а не после «ОК»
      await save({
        familyCode: res.family.code,
        memberId: res.member.id,
        name: res.member.name,
        role: res.member.role,
        token: res.member.token,
      })
      navigate('/created', { replace: true, state: { invite: res.invite } })
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'network'
        ? 'Нет связи с сервером. Попробуйте ещё раз.'
        : 'Не удалось создать семью. Попробуйте ещё раз.')
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <Link className="back" to="/">← Назад</Link>
      <h1>Создаём семью</h1>
      <RoleForm roles={CREATOR_ROLES} submitLabel="Создать" busy={busy} error={error} onSubmit={handleSubmit} />
    </main>
  )
}
