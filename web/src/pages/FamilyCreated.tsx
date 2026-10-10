import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

interface State {
  invite?: { code: string; expiresAt: string }
}

export default function FamilyCreated() {
  const { state } = useLocation() as { state: State | null }
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const invite = state?.invite
  // страницу открыли напрямую или обновили — приглашения у нас уже нет
  if (!invite) return <Navigate to="/family" replace />

  const link = `${window.location.origin}/join?code=${encodeURIComponent(invite.code)}`
  const expires = new Date(invite.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      /* без clipboard ссылку можно выделить и скопировать вручную */
    }
  }

  return (
    <main className="page">
      <div className="success" aria-hidden>🎉</div>
      <h1>Семья создана!</h1>
      <p>Отправьте эту ссылку тем, кого хотите пригласить. Она действует до {expires}.</p>

      <div className="invite-box">
        <code>{link}</code>
        <button className="btn" type="button" onClick={copy}>{copied ? 'Скопировано' : 'Копировать'}</button>
      </div>

      <button className="btn primary" type="button" onClick={() => navigate('/family', { replace: true })}>
        ОК
      </button>
    </main>
  )
}
