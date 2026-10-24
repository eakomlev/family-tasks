import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native'
import { Redirect } from 'expo-router'
import { ApiError, getInvite, inviteByEmail, renewInvite, type Link } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
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

interface Recipient {
  email: string
  status: 'idle' | 'sending' | 'sent'
  error?: string
}

const STATUS_TEXT = { idle: '', sending: 'Отправляем…', sent: 'Отправлено' } as const

// Небольшое окно для ввода адреса: «Добавить» проверяет адрес и закрывает окно, неверный адрес остаётся в поле с подсказкой
function AddEmailDialog({ onAdd, onClose }: { onAdd: (email: string) => string | undefined; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()

  function submit() {
    const problem = onAdd(value)
    if (problem) setError(problem)
    else onClose()
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(10, 12, 30, 0.6)' }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380 }}>
            <Card style={{ gap: 12, padding: 20, borderRadius: 26 }} accessibilityViewIsModal>
              <Heading>Добавить адрес</Heading>
              <Input
                autoFocus
                value={value}
                onChangeText={(text) => {
                  setValue(text)
                  setError(undefined)
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="name@example.com"
                accessibilityLabel="Email"
                onSubmitEditing={submit}
              />
              {error && <Text $size={13} $tone="error">{error}</Text>}
              <Button variant="primary" disabled={!value.trim()} onPress={submit}>
                Добавить
              </Button>
              <Button variant="text" onPress={onClose}>
                Отмена
              </Button>
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// Приглашение по email: адреса берут из контактов телефона или добавляют вручную, как только есть хотя бы один, появляется «Пригласить».
function InviteByEmail({ token }: { token: string }) {
  const guard = useInFlight()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [dialog, setDialog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()

  // Добавляет адреса в список; возвращает текст ошибки, если какой-то адрес не похож на email
  const addEmails = (emails: string[]): string | undefined => {
    const normalized = emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
    const bad = normalized.filter((e) => !isValidEmail(e))
    if (bad.length > 0) return `Не похоже на email: ${bad.join(', ')}`
    setRecipients((current) => {
      const next = [...current]
      for (const email of normalized) if (!next.some((r) => r.email === email)) next.push({ email, status: 'idle' })
      return next
    })
    return undefined
  }

  const pick = guard(async () => {
    setNotice(undefined)
    try {
      const problem = addEmails((await pickContact()).map((c) => c.email))
      if (problem) setNotice(problem)
    } catch (err) {
      setNotice((err as Error).message === 'no_permission' ? 'Нет доступа к контактам. Разрешите его в настройках телефона или добавьте адрес вручную.' : 'Не удалось открыть контакты. Добавьте адрес вручную.')
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
      <Heading>Выбрать контакты</Heading>
      <Text $tone="muted">Мы отправим письмо со ссылкой. Человек откроет её, подтвердит email кодом и выберет, кто он в семье.</Text>
      <Button onPress={pick}>Выбрать из контактов</Button>
      <Text $tone="accent" $weight="extraBold" onPress={() => setDialog(true)} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        Добавить адрес
      </Text>
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
          {busy ? 'Отправляем…' : `Пригласить: ${pending.length}`}
        </Button>
      )}
      {dialog && <AddEmailDialog onAdd={(email) => addEmails([email])} onClose={() => setDialog(false)} />}
    </Stack>
  )
}

// Приглашение в семью: создатель семьи зовёт двумя способами, письмом по контактам или ссылкой вручную
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
            <InviteByEmail token={identity.token} />
          </Card>
          <Card>
            <Stack>
              <Heading>Отправить ссылку вручную</Heading>
              <Text $tone="muted">Скопируйте ссылку или поделитесь ею в любом мессенджере.</Text>
              <InviteLink token={identity.token} />
            </Stack>
          </Card>
        </>
      )}
    </Screen>
  )
}
