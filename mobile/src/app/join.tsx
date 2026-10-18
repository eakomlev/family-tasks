import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ApiError, checkInvite, joinFamily, type SignupData } from '@/api'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { ReplaceGuard } from '@/components/ReplaceGuard'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { RoleForm } from '@/features/auth/RoleForm'
import { extractCode } from '@/features/auth/inviteCode'
import { useIdentity } from '@/identity/context'
import { toIdentity } from '@/identity/utils'
import { retryRead } from '@/lib/retry'
import { JOIN_ROLES } from '@/lib/roles'

type InviteState = 'checking' | 'ok' | 'not_found' | 'expired' | 'error'

const PROBLEMS: Partial<Record<InviteState, string>> = {
  not_found: 'Приглашение не найдено. Проверьте ссылку.',
  expired: 'Срок приглашения истёк. Попросите прислать новое.',
  error: 'Не удалось проверить приглашение. Попробуйте позже.',
}

// Ввод ссылки или кода приглашения: человек вставил то, что ему прислали
function EnterCode({ onCode }: { onCode: (code: string) => void }) {
  const [value, setValue] = useState('')
  const code = extractCode(value)
  return (
    <Stack>
      <Text>Вставьте ссылку-приглашение или её код.</Text>
      <Field label="Приглашение">
        <Input
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://…/join?code=…"
          onSubmitEditing={() => code && onCode(code)}
        />
      </Field>
      <Button variant="primary" disabled={!code} onPress={() => onCode(code)}>
        Продолжить
      </Button>
    </Stack>
  )
}

function JoinWithCode({ code, email }: { code: string; email?: string }) {
  const { save } = useIdentity()
  const router = useRouter()
  const [invite, setInvite] = useState<InviteState>('checking')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    retryRead(() => checkInvite(code), controller.signal)
      .then(() => !cancelled && setInvite('ok'))
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'invite_expired') setInvite('expired')
        else if (err instanceof ApiError && err.status === 404) setInvite('not_found')
        else setInvite('error')
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [code])

  async function handleSubmit(data: SignupData) {
    await save(toIdentity(await joinFamily(code, data)))
    router.replace('/')
  }

  if (invite === 'checking') return <Text $tone="muted">Проверяем приглашение…</Text>
  const problem = PROBLEMS[invite]
  if (problem) return <Notice tone="error">{problem}</Notice>

  return (
    <Stack>
      <Text>Вас приглашают в семью.</Text>
      <RoleForm roles={JOIN_ROLES} submitLabel="Присоединиться" initialEmail={email} onSubmit={handleSubmit} />
    </Stack>
  )
}

// Присоединение по приглашению. Ссылка `/join?code=…&email=…` открывает приложение сразу на нужном шаге (универсальные ссылки подключим в фазе 6).
export default function Join() {
  const router = useRouter()
  const params = useLocalSearchParams<{ code?: string; email?: string }>()
  const [entered, setEntered] = useState<string>()
  const code = params.code || entered

  return (
    <AuthScreen>
      <Button variant="text" onPress={() => router.back()}>
        ← Назад
      </Button>
      <Title>Присоединиться к семье</Title>
      <ReplaceGuard>{code ? <JoinWithCode key={code} code={code} email={params.email} /> : <EnterCode onCode={setEntered} />}</ReplaceGuard>
    </AuthScreen>
  )
}
