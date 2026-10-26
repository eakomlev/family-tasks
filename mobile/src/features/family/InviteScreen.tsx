import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { ApiError, getInvite, renewInvite, type Link } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { LinkBox } from '@/components/LinkBox'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { inviteLink } from '@/lib/links'
import { retryRead } from '@/lib/retry'
import { useProfile } from '@/profile/context'

// Ссылка-приглашение: действующая показывается; если ссылки нет или она истекла, новая выпускается сама (в том числе когда срок
// кончился, пока экран открыт)
function InviteLink({ token }: { token: string }) {
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
        // срок кончится, пока экран открыт: выпускаем новую (ограничение таймера около 24 суток, у ссылки 7)
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
    <Stack>
      {!invite && !error && <Text $tone="muted">Загрузка…</Text>}
      {invite && <LinkBox link={inviteLink(invite.code)} expiresAt={invite.expiresAt} />}
      {error && (
        <Notice tone="error">
          Не получилось подготовить ссылку.{' '}
          <Text $tone="accent" onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button">
            Повторить
          </Text>
        </Notice>
      )}
    </Stack>
  )
}

// Приглашение в семью: создатель семьи отправляет ссылку в любом мессенджере, человек присоединяется по ней
export function InviteScreen() {
  const { identity } = useIdentity()
  const { data } = useProfile()

  // остальным участникам здесь делать нечего
  if (data && !data.me.isOwner) return <Redirect href="/family" />

  return (
    <Screen header={<PageHeader fallback="/family">Пригласить в семью</PageHeader>}>
      <Text $tone="muted">По приглашению можно присоединиться как мама, папа, бабушка, дедушка или ребёнок.</Text>
      {identity && data && (
        <>
          <Card>
            <Stack>
              <Heading>Ссылка-приглашение</Heading>
              <Text $tone="muted">Скопируйте ссылку или поделитесь ею в любом мессенджере. Человек откроет её, подтвердит email или номер телефона кодом и выберет, кто он в семье.</Text>
              <InviteLink token={identity.token} />
            </Stack>
          </Card>
        </>
      )}
    </Screen>
  )
}
