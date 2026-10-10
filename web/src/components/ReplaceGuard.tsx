import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useIdentity } from '../identityContext'

// если на устройстве уже есть вход, просим явно подтвердить его замену
export function ReplaceGuard({ children }: { children: ReactNode }) {
  const { identity } = useIdentity()
  const [confirmed, setConfirmed] = useState(false)

  if (!identity || confirmed) return <>{children}</>

  return (
    <div className="stack">
      <p className="warning">
        На этом устройстве вы уже вошли как <strong>{identity.name}</strong>. Если продолжить, этот вход будет заменён, и вернуться
        к нему можно будет только по новой ссылке.
      </p>
      <button className="btn danger" type="button" onClick={() => setConfirmed(true)}>
        Всё равно продолжить
      </button>
      <Link className="btn" to="/family">Остаться как сейчас</Link>
    </div>
  )
}
