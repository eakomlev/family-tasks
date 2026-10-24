import { useEffect, useState } from 'react'
import { ApiError, getInvite, renewInvite, type Link } from '@/api'
import { LinkBox } from '@/components/LinkBox'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { inviteLink } from '@/lib/links'
import { retryRead } from '@/lib/retry'
import type { InviteSectionProps } from './types'

// Ссылка-приглашение: действующая показывается; если ссылки нет или она истекла, новая выпускается сама (в том числе когда срок
// кончился, пока страница открыта)
export function InviteSection({ token }: InviteSectionProps) {
  const [invite, setInvite] = useState<Link>()
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()

    async function load() {
      setError(false)
      try {
        let current: Link | null = await retryRead(() => getInvite(token), controller.signal).catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null
          throw err
        })
        if (!current || new Date(current.expiresAt).getTime() <= Date.now()) current = await renewInvite(token)
        if (cancelled) return
        setInvite(current)
        // срок кончится, пока страница открыта: выпускаем новую (таймер не больше 24 суток, у ссылки 7)
        const left = new Date(current.expiresAt).getTime() - Date.now()
        timer = setTimeout(() => void load(), Math.min(Math.max(left, 1000), 2_000_000_000))
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      controller.abort()
    }
  }, [token, attempt])

  return (
    <Stack as="section">
      {!invite && !error && <p>Загрузка…</p>}
      {invite && <LinkBox link={inviteLink(invite.code)} expiresAt={invite.expiresAt} />}
      {error && (
        <Notice $tone="error">
          Не получилось подготовить ссылку.{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Повторить
          </button>
        </Notice>
      )}
    </Stack>
  )
}
