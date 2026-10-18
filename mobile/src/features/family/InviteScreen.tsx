import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { ApiError, getInvite, inviteByEmail, renewInvite, type Link } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { LinkBox } from '@/components/LinkBox'
import { Notice } from '@/components/Notice'
import { Screen } from '@/components/Screen'
import { Stack } from '@/components/Stack'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { describeInviteEmailError } from '@/lib/errors'
import { pickContact } from '@/lib/contacts'
import { inviteLink } from '@/lib/links'
import { retryRead } from '@/lib/retry'
import { useInFlight } from '@/lib/useInFlight'
import { isValidEmail } from '@/lib/validation'
import { useProfile } from '@/profile/context'

// Ссылка-приглашение: действующая показывается, новая заменяет прежнюю (так можно отозвать утёкшую ссылку)
function InviteLink({ token }: { token: string }) {
  const guard = useInFlight()
  // undefined — загружаем, null — действующего приглашения нет
  const [invite, setInvite] = useState<Link | null>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    retryRead(() => getInvite(token), controller.signal)
      .then((res) => !cancelled && setInvite(res))
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setInvite(null)
        else setError(true)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [token])

  const renew = guard(async () => {
    setBusy(true)
    setError(false)
    try {
      setInvite(await renewInvite(token))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  })

  return (
    <Stack>
      {invite === undefined && !error && <Text $tone="muted">Загрузка…</Text>}
      {invite === null && <Notice>Прошлое приглашение истекло.</Notice>}
      {invite && <LinkBox link={inviteLink(invite.code)} expiresAt={invite.expiresAt} />}
      {error && <Notice tone="error">Не получилось. Попробуйте ещё раз.</Notice>}
      {invite !== undefined && (
        <Button disabled={busy} onPress={renew}>
          {invite ? 'Новая ссылка (старая перестанет работать)' : 'Создать ссылку'}
        </Button>
      )}
    </Stack>
  )
}

interface Recipient {
  email: string
  status: 'idle' | 'sending' | 'sent'
  error?: string
}

const STATUS_TEXT = { idle: '', sending: 'Отправляем…', sent: 'Отправлено' } as const

// Приглашение по email: адреса берут из контактов телефона или вводят по одному, потом на них уходят письма со ссылкой.
function InviteByEmail({ token }: { token: string }) {
  const guard = useInFlight()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()

  const addEmails = (emails: string[]) => {
    const normalized = emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
    const bad = normalized.filter((e) => !isValidEmail(e))
    setNotice(bad.length > 0 ? `Не похоже на email: ${bad.join(', ')}` : undefined)
    setRecipients((current) => {
      const next = [...current]
      for (const email of normalized.filter(isValidEmail)) if (!next.some((r) => r.email === email)) next.push({ email, status: 'idle' })
      return next
    })
    return bad.length === 0
  }

  function add() {
    if (typed.trim() && addEmails([typed])) setTyped('')
  }

  const pick = guard(async () => {
    setNotice(undefined)
    try {
      addEmails((await pickContact()).map((c) => c.email))
    } catch (err) {
      setNotice((err as Error).message === 'no_permission' ? 'Нет доступа к контактам. Разрешите его в настройках телефона или введите адрес вручную.' : 'Не удалось открыть контакты. Введите адрес вручную.')
    }
  })

  const patch = (email: string, change: Partial<Recipient>) => setRecipients((current) => current.map((r) => (r.email === email ? { ...r, ...change } : r)))

  // письма уходят по одному: у каждого свой результат (уже в семье, слишком часто и т. п.)
  const send = guard(async () => {
    setBusy(true)
    setNotice(undefined)
    for (const r of recipients.filter((x) => x.status !== 'sent')) {
      patch(r.email, { status: 'sending', error: undefined })
      try {
        await inviteByEmail(token, r.email)
        patch(r.email, { status: 'sent' })
      } catch (err) {
        patch(r.email, { status: 'idle', error: describeInviteEmailError(err) })
      }
    }
    setBusy(false)
  })

  const pending = recipients.filter((r) => r.status !== 'sent')

  return (
    <Stack>
      <Heading>Пригласить по email</Heading>
      <Text>Мы отправим письмо со ссылкой. Человек откроет её, подтвердит свой email кодом и выберет, кто он в семье.</Text>
      <Button onPress={pick}>Выбрать из контактов</Button>
      <Field label="Или введите адрес">
        <Input
          value={typed}
          onChangeText={setTyped}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="name@example.com"
          onSubmitEditing={add}
        />
      </Field>
      <Button disabled={!typed.trim()} onPress={add}>
        Добавить адрес
      </Button>
      {notice && <Notice tone="error">{notice}</Notice>}
      {recipients.map((r) => (
        <View key={r.email} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1 }}>{r.email}</Text>
            <Text $size={13} $tone="muted">
              {STATUS_TEXT[r.status]}
            </Text>
            {r.status !== 'sent' && (
              <Text $tone="accent" onPress={() => setRecipients((current) => current.filter((x) => x.email !== r.email))} accessibilityRole="button">
                Убрать
              </Text>
            )}
          </View>
          {r.error && (
            <Text $size={13} $tone="error">
              {r.error}
            </Text>
          )}
        </View>
      ))}
      {pending.length > 0 && (
        <Button variant="primary" disabled={busy} onPress={send}>
          {busy ? 'Отправляем…' : `Отправить письма: ${pending.length}`}
        </Button>
      )}
    </Stack>
  )
}

// Приглашение в семью: ссылку видит и перевыпускает только создатель семьи
export function InviteScreen() {
  const { identity } = useIdentity()
  const { data } = useProfile()

  // остальным участникам здесь делать нечего
  if (data && !data.me.isOwner) return <Redirect href="/family" />

  return (
    <Screen header={<PageHeader fallback="/family">Пригласить в семью</PageHeader>}>
      <Text>Отправьте ссылку тому, кого хотите добавить. По ней можно присоединиться как мама, папа, бабушка, дедушка или ребёнок.</Text>
      {identity && data && <InviteLink token={identity.token} />}
      {identity && data && <InviteByEmail token={identity.token} />}
    </Screen>
  )
}
