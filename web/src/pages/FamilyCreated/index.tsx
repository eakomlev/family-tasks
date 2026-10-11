import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getInvite, type Link } from '@/api'
import { Button } from '@/components/Button'
import { LinkBox } from '@/components/LinkBox'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { inviteLink } from '@/lib/links'
import { Celebration } from './styles'
import type { LocationState } from './types'
import { START_PATH } from '@/lib/routes'

export default function FamilyCreated() {
  const { identity } = useIdentity()
  const { state } = useLocation() as { state: LocationState | null }
  const navigate = useNavigate()
  // после обновления страницы state теряется, поэтому приглашение можно запросить заново
  const [invite, setInvite] = useState<Link | undefined>(state?.invite)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (invite || !identity) return
    getInvite(identity.token).then(setInvite).catch(() => setFailed(true))
  }, [invite, identity])

  if (!identity || failed) return <Navigate to="/family" replace />

  return (
    <Page>
      <Celebration aria-hidden>🎉</Celebration>
      <h1>Семья создана!</h1>
      <p>Отправьте эту ссылку тем, кого хотите пригласить.</p>

      {invite ? <LinkBox link={inviteLink(invite.code)} expiresAt={invite.expiresAt} /> : <p>Загрузка…</p>}

      <Button $variant="primary" type="button" onClick={() => navigate(START_PATH, { replace: true })}>
        ОК
      </Button>
    </Page>
  )
}
