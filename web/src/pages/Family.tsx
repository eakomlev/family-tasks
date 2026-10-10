import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError, createRecovery, getInvite, getMe, renewInvite, type Link, type Member } from '../api'
import { LinkBox } from '../components/LinkBox'
import { useIdentity, type Identity } from '../identityContext'
import { inviteLink, recoveryLink } from '../links'
import { ROLE_LABELS } from '../roles'

function InviteSection({ token }: { token: string }) {
  const [invite, setInvite] = useState<Link | null>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getInvite(token)
      .then((res) => !cancelled && setInvite(res))
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setInvite(null)
        else setError(true)
      })
    return () => { cancelled = true }
  }, [token])

  async function renew() {
    setBusy(true)
    setError(false)
    try {
      setInvite(await renewInvite(token))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="stack">
      <h2>Пригласить в семью</h2>
      {invite === undefined && !error && <p>Загрузка…</p>}
      {invite === null && <p className="muted">Прошлое приглашение истекло.</p>}
      {invite && <LinkBox link={inviteLink(invite.code)} expiresAt={invite.expiresAt} />}
      {error && <p className="error">Не получилось. Попробуйте ещё раз.</p>}
      {invite !== undefined && (
        <button className="btn" type="button" disabled={busy} onClick={renew}>
          {invite ? 'Новая ссылка (старая перестанет работать)' : 'Создать ссылку'}
        </button>
      )}
    </section>
  )
}

function MemberRow({ member, identity, canIssue }: { member: Member; identity: Identity; canIssue: boolean }) {
  const [link, setLink] = useState<Link>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const isMe = member.id === identity.memberId

  async function issue() {
    setBusy(true)
    setError(false)
    try {
      setLink(await createRecovery(identity.token, member.id))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      <div className="row">
        <span>{member.name}{isMe && ' (вы)'}</span>
        <span className="muted">{ROLE_LABELS[member.role]}{member.isOwner && ' · создатель'}</span>
      </div>
      {canIssue && !link && (
        <button className="btn small" type="button" disabled={busy} onClick={issue}>
          {isMe ? 'Войти на другом устройстве' : 'Ссылка для входа'}
        </button>
      )}
      {error && <p className="error">Не удалось создать ссылку.</p>}
      {link && (
        <>
          <LinkBox link={recoveryLink(link.code)} expiresAt={link.expiresAt} />
          <p className="muted">Ссылка одноразовая. После входа по ней старое устройство {isMe ? 'потеряет' : `${member.name} потеряет`} доступ.</p>
        </>
      )}
    </li>
  )
}

export default function Family() {
  const { identity, clear } = useIdentity()
  const [data, setData] = useState<{ me: Member; members: Member[] }>()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!identity) return
    let cancelled = false
    getMe(identity.token)
      .then((res) => !cancelled && setData({ me: res.member, members: res.members }))
      .catch((err) => {
        if (cancelled) return
        // токен больше не действителен (например, вошли с другого устройства)
        if (err instanceof ApiError && err.status === 401) clear()
        else setError(true)
      })
    return () => { cancelled = true }
  }, [identity, clear])

  if (!identity) return <Navigate to="/" replace />

  return (
    <main className="page">
      <h1>Ваша семья</h1>
      <p>Вы вошли как <strong>{identity.name}</strong> ({ROLE_LABELS[identity.role]}). Код семьи: <code>{identity.familyCode}</code></p>

      {data?.me.isOwner && <InviteSection token={identity.token} />}

      <h2>Участники</h2>
      {error && <p className="error">Не удалось загрузить список. Проверьте соединение.</p>}
      {!data && !error && <p>Загрузка…</p>}
      <ul className="members">
        {data?.members.map((m) => (
          <MemberRow key={m.id} member={m} identity={identity} canIssue={m.id === identity.memberId || data.me.isOwner} />
        ))}
      </ul>
    </main>
  )
}
