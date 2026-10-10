import { Link, useNavigate } from 'react-router-dom'
import { createFamily, type SignupData } from '../api'
import { RoleForm } from '../components/RoleForm'
import { useIdentity } from '../identityContext'
import { CREATOR_ROLES } from '../roles'

export default function CreateFamily() {
  const { save } = useIdentity()
  const navigate = useNavigate()

  async function handleSubmit(data: SignupData) {
    const res = await createFamily(data)
    await save({
      familyCode: res.family.code,
      memberId: res.member.id,
      name: res.member.name,
      role: res.member.role,
      token: res.member.token,
    })
    navigate('/created', { replace: true, state: { invite: res.invite } })
  }

  return (
    <main className="page">
      <Link className="back" to="/">← Назад</Link>
      <h1>Создаём семью</h1>
      <RoleForm roles={CREATOR_ROLES} submitLabel="Создать семью" onSubmit={handleSubmit} />
    </main>
  )
}
