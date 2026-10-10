import { useNavigate } from 'react-router-dom'
import { createFamily, type SignupData } from '@/api'
import { BackLink } from '@/components/BackLink'
import { Page } from '@/components/Page'
import { RoleForm } from '@/components/RoleForm'
import { useIdentity } from '@/identity/context'
import { toIdentity } from '@/identity/utils'
import { CREATOR_ROLES } from '@/lib/roles'

export default function CreateFamily() {
  const { save } = useIdentity()
  const navigate = useNavigate()

  async function handleSubmit(data: SignupData) {
    const res = await createFamily(data)
    await save(toIdentity(res))
    navigate('/created', { replace: true, state: { invite: res.invite } })
  }

  return (
    <Page>
      <BackLink to="/">← Назад</BackLink>
      <h1>Создаём семью</h1>
      <RoleForm roles={CREATOR_ROLES} submitLabel="Создать семью" onSubmit={handleSubmit} />
    </Page>
  )
}
