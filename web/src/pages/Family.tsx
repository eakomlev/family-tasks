import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError, getMe, type Member } from '../api'
import { useIdentity } from '../identity'
import { ROLE_LABELS } from '../roles'

export default function Family() {
  const { identity, clear } = useIdentity()
  const [members, setMembers] = useState<Member[]>()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!identity) return
    let cancelled = false
    getMe(identity.token)
      .then((res) => !cancelled && setMembers(res.members))
      .catch((err) => {
        if (cancelled) return
        // токен больше не действителен — забываем его и возвращаем на вход
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

      <h2>Участники</h2>
      {error && <p className="error">Не удалось загрузить список. Проверьте соединение.</p>}
      {!members && !error && <p>Загрузка…</p>}
      <ul className="members">
        {members?.map((m) => (
          <li key={m.id}>
            <span>{m.name}{m.id === identity.memberId && ' (вы)'}</span>
            <span className="muted">{ROLE_LABELS[m.role]}{m.isOwner && ' · создатель'}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
