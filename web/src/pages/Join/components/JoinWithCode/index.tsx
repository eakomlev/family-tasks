import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, checkInvite, joinFamily, type SignupData } from '@/api'
import { Notice } from '@/components/Notice'
import { ReplaceGuard } from '@/components/ReplaceGuard'
import { RoleForm } from '@/components/RoleForm'
import { useIdentity } from '@/identity/context'
import { toIdentity } from '@/identity/utils'
import { JOIN_ROLES } from '@/lib/roles'
import type { InviteState, JoinWithCodeProps } from './types'

const PROBLEMS: Partial<Record<InviteState, string>> = {
  not_found: 'Приглашение не найдено. Проверьте ссылку.',
  expired: 'Срок приглашения истёк. Попросите прислать новое.',
  error: 'Не удалось проверить приглашение. Попробуйте позже.',
}

export function JoinWithCode({ code }: JoinWithCodeProps) {
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
    await save(toIdentity(res))
    navigate('/family', { replace: true })
  }

  if (invite === 'checking') return <p>Проверяем приглашение…</p>

  const problem = PROBLEMS[invite]
  if (problem) return <Notice $tone="error">{problem}</Notice>

  return (
    <>
      <p>Вас приглашают в семью.</p>
      <ReplaceGuard>
        <RoleForm roles={JOIN_ROLES} submitLabel="Присоединиться" onSubmit={handleSubmit} />
      </ReplaceGuard>
    </>
  )
}
