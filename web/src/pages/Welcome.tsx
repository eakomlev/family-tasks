import { Link, Navigate } from 'react-router-dom'
import { useIdentity } from '../identityContext'

export default function Welcome() {
  const { identity } = useIdentity()
  if (identity) return <Navigate to="/family" replace />

  return (
    <main className="page welcome">
      <div className="hero">
        <div className="logo" aria-hidden>✓</div>
        <h1>Семейные задачи</h1>
        <p>Один общий список дел для всей семьи: кто что делает, что уже готово и что ждёт своей очереди.</p>
      </div>
      <div className="actions">
        <Link className="btn primary" to="/create">Создать семью</Link>
        <Link className="link" to="/join">У меня есть приглашение</Link>
      </div>
    </main>
  )
}
