import { useEffect, useState } from 'react'
import { ApiError, getInvite, renewInvite, type Link } from '@/api'
import { Button } from '@/components/Button'
import { LinkBox } from '@/components/LinkBox'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { inviteLink } from '@/lib/links'
import type { InviteSectionProps } from './types'

export function InviteSection({ token }: InviteSectionProps) {
  // undefined — загружаем, null — действующего приглашения нет
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
    <Stack as="section">
      <h2>Пригласить в семью</h2>
      {invite === undefined && !error && <p>Загрузка…</p>}
      {invite === null && <Notice $tone="muted">Прошлое приглашение истекло.</Notice>}
      {invite && <LinkBox link={inviteLink(invite.code)} expiresAt={invite.expiresAt} />}
      {error && <Notice $tone="error">Не получилось. Попробуйте ещё раз.</Notice>}
      {invite !== undefined && (
        <Button type="button" disabled={busy} onClick={renew}>
          {invite ? 'Новая ссылка (старая перестанет работать)' : 'Создать ссылку'}
        </Button>
      )}
    </Stack>
  )
}
