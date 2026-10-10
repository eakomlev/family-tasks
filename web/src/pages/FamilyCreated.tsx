import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getInvite, type Link } from '../api'
import { LinkBox } from '../components/LinkBox'
import { useIdentity } from '../identityContext'
import { inviteLink } from '../links'

export default function FamilyCreated() {
  const { identity } = useIdentity()
  const { state } = useLocation() as { state: { invite?: Link } | null }
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
    <main className="page">
      <div className="success" aria-hidden>🎉</div>
      <h1>Семья создана!</h1>
      <p>Отправьте эту ссылку тем, кого хотите пригласить.</p>

      {invite ? <LinkBox link={inviteLink(invite.code)} expiresAt={invite.expiresAt} /> : <p>Загрузка…</p>}

      <button className="btn primary" type="button" onClick={() => navigate('/family', { replace: true })}>
        ОК
      </button>
    </main>
  )
}
