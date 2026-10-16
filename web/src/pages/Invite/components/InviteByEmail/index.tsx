import { useState, type FormEvent } from 'react'
import { inviteByEmail } from '@/api'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { contactPickerSupported, pickContacts } from '@/lib/contacts'
import { describeInviteEmailError } from '@/lib/errors'
import { useInFlight } from '@/lib/useInFlight'
import { isValidEmail } from '@/lib/validation'
import { AddRow, List, Remove, Row, Status, Who } from './styles'
import type { InviteByEmailProps, Recipient } from './types'

const STATUS_TEXT = { idle: '', sending: 'Отправляем…', sent: 'Отправлено' } as const

// Приглашение по email: адреса выбирают из контактов телефона (где это умеет браузер) или вводят, потом на них уходят письма со
// ссылкой. Получатель открывает ссылку, проходит проверку, подтверждает адрес кодом и выбирает роль.
export function InviteByEmail({ token }: InviteByEmailProps) {
  const guard = useInFlight()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const canPick = contactPickerSupported()

  const add = (items: { email: string; name?: string }[]) => {
    const normalized = items.map((item) => ({ name: item.name, email: item.email.trim().toLowerCase() }))
    const bad = normalized.filter((item) => !isValidEmail(item.email)).map((item) => item.email)
    const good = normalized.filter((item) => isValidEmail(item.email))
    setRecipients((current) => {
      const next = [...current]
      for (const { email, name } of good) {
        if (!next.some((r) => r.email === email)) next.push({ email, name: name || undefined, status: 'idle' })
      }
      return next
    })
    setNotice(bad.length > 0 ? `Не похоже на email: ${bad.join(', ')}` : undefined)
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!typed.trim()) return
    add([{ email: typed }])
    if (isValidEmail(typed)) setTyped('')
  }

  const pick = guard(async () => {
    setNotice(undefined)
    try {
      add(await pickContacts())
    } catch {
      setNotice('Не удалось открыть контакты. Введите адрес вручную.')
    }
  })

  const patch = (email: string, change: Partial<Recipient>) =>
    setRecipients((current) => current.map((r) => (r.email === email ? { ...r, ...change } : r)))

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
    <Stack as="section">
      <h2>Пригласить по email</h2>
      <p>Мы отправим письмо со ссылкой. Человек откроет её, подтвердит свой email кодом и выберет, кто он в семье.</p>
      {canPick && (
        <Button type="button" disabled={busy} onClick={pick}>
          Выбрать из контактов
        </Button>
      )}
      <form onSubmit={handleAdd} noValidate>
        <AddRow>
          <Input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="name@example.com"
            aria-label="Email приглашаемого"
            value={typed}
            maxLength={254}
            disabled={busy}
            onChange={(e) => setTyped(e.target.value)}
          />
          <Button type="submit" $inline disabled={busy || !typed.trim()}>
            Добавить
          </Button>
        </AddRow>
      </form>
      {notice && <Notice $tone="error">{notice}</Notice>}

      {recipients.length > 0 && (
        <List aria-label="Кого пригласить">
          {recipients.map((r) => (
            <Row key={r.email}>
              <Who>
                <strong>{r.name || r.email}</strong>
                {r.name && <small>{r.email}</small>}
              </Who>
              <Status $tone={r.error ? 'error' : r.status === 'sent' ? 'ok' : 'muted'}>{r.error ?? STATUS_TEXT[r.status]}</Status>
              {r.status !== 'sent' && r.status !== 'sending' && (
                <Remove type="button" aria-label={`Убрать ${r.email}`} disabled={busy} onClick={() => setRecipients((c) => c.filter((x) => x.email !== r.email))}>
                  ×
                </Remove>
              )}
            </Row>
          ))}
        </List>
      )}
      {pending.length > 0 && (
        <Button $variant="primary" type="button" disabled={busy} onClick={send}>
          {busy ? 'Отправляем…' : pending.length === 1 ? 'Отправить приглашение' : `Отправить приглашения: ${pending.length}`}
        </Button>
      )}
    </Stack>
  )
}
