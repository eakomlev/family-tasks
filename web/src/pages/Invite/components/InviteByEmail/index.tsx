import { useState } from 'react'
import { inviteByEmail } from '@/api'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { contactPickerSupported, pickContacts } from '@/lib/contacts'
import { describeInviteEmailError } from '@/lib/errors'
import { useInFlight } from '@/lib/useInFlight'
import { isValidEmail } from '@/lib/validation'
import { AddEmailDialog } from '../AddEmailDialog'
import { AddLink, List, Remove, Row, Status, Who } from './styles'
import type { InviteByEmailProps, Recipient } from './types'

const STATUS_TEXT = { idle: '', sending: 'Отправляем…', sent: 'Отправлено' } as const

// Приглашение по email: адреса выбирают из контактов телефона (где это умеет браузер) или добавляют вручную в небольшом окне,
// как только есть хотя бы один адрес, появляется «Пригласить»: на адреса уходят письма со ссылкой. Получатель открывает ссылку, проходит проверку, подтверждает адрес кодом и выбирает роль.
export function InviteByEmail({ token }: InviteByEmailProps) {
  const guard = useInFlight()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [dialog, setDialog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const canPick = contactPickerSupported()

  // Добавляет адреса в список; возвращает текст ошибки, если какой-то адрес не похож на email
  const add = (items: { email: string; name?: string }[]): string | undefined => {
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
    return bad.length > 0 ? `Не похоже на email: ${bad.join(', ')}` : undefined
  }

  const pick = guard(async () => {
    setNotice(undefined)
    try {
      setNotice(add(await pickContacts()))
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
      <h2>Выбрать контакты</h2>
      <p>Мы отправим письмо со ссылкой. Человек откроет её, подтвердит свой email кодом и выберет, кто он в семье.</p>
      {canPick && (
        <Button type="button" disabled={busy} onClick={pick}>
          Выбрать из контактов
        </Button>
      )}
      <AddLink type="button" disabled={busy} onClick={() => setDialog(true)}>
        Добавить адрес
      </AddLink>
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
          {busy ? 'Отправляем…' : `Пригласить: ${pending.length}`}
        </Button>
      )}
      {dialog && <AddEmailDialog onAdd={(email) => add([{ email }])} onClose={() => setDialog(false)} />}
    </Stack>
  )
}
