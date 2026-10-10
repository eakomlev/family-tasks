import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError, getMe, logout } from '@/api'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Page } from '@/components/Page'
import { useIdentity } from '@/identity/context'
import { ROLE_LABELS } from '@/lib/roles'
import { InviteSection } from './components/InviteSection'
import { MemberRow } from './components/MemberRow'
import { Members } from './styles'
import type { FamilyData } from './types'

export default function Family() {
  const { identity, clear } = useIdentity()
  const [data, setData] = useState<FamilyData>()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!identity) return
    let cancelled = false
    getMe(identity.token)
      .then((res) => !cancelled && setData({ me: res.member, members: res.members }))
      .catch((err) => {
        if (cancelled) return
        // токен больше не действителен (например, сессию отозвали)
        if (err instanceof ApiError && err.status === 401) clear()
        else setError(true)
      })
    return () => { cancelled = true }
  }, [identity, clear])

  async function handleLogout() {
    if (!identity) return
    // даже если сервер недоступен, на этом устройстве всё равно выходим
    await logout(identity.token).catch(() => {})
    await clear()
  }

  if (!identity) return <Navigate to="/" replace />

  return (
    <Page>
      <h1>Ваша семья</h1>
      <p>Вы вошли как <strong>{identity.name}</strong> ({ROLE_LABELS[identity.role]}). Код семьи: <code>{identity.familyCode}</code></p>

      {data?.me.isOwner && <InviteSection token={identity.token} />}

      <h2>Участники</h2>
      {error && <Notice $tone="error">Не удалось загрузить список. Проверьте соединение.</Notice>}
      {!data && !error && <p>Загрузка…</p>}
      <Members>
        {data?.members.map((m) => (
          <MemberRow key={m.id} member={m} isMe={m.id === identity.memberId} />
        ))}
      </Members>

      <Button type="button" onClick={handleLogout}>Выйти</Button>
    </Page>
  )
}
