import { useState } from 'react'
import { View } from 'react-native'
import { useDispatch } from 'react-redux'
import { ApiError, createFamilyForMe, joinFamilyAsMe, type MemberFamilyResult } from '@/api'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Heading, Text, Title } from '@/components/Text'
import { extractCode } from '@/features/auth/inviteCode'
import { describeSignupError } from '@/features/auth/signupErrors'
import { useIdentity } from '@/identity/context'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { useInFlight } from '@/lib/useInFlight'
import { api } from '@/store/api'

const CREATE_ROLES = ['mama', 'papa'] as const
// кем взрослый может вступить в чужую семью (ребёнком нельзя)
const JOIN_ROLES = ['mama', 'papa', 'grandma', 'grandpa'] as const

function RolePicker<T extends Role>({ roles, value, onChange }: { roles: readonly T[]; value: T; onChange: (role: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {roles.map((r) => (
        <Chip key={r} active={value === r} onPress={() => onChange(r)}>
          {ROLE_LABELS[r]}
        </Chip>
      ))}
    </View>
  )
}

// Экран для участника без семьи (создатель убрал его из семьи): аккаунт и вход остались, нужно создать новую семью или вступить в другую по ссылке.
// Закрывает приложение, пока человек не выбрал; «Выйти» выходит на этом устройстве.
export function NoFamilyScreen() {
  const guard = useInFlight()
  const dispatch = useDispatch()
  const { identity, save, clear } = useIdentity()
  const [createRole, setCreateRole] = useState<'mama' | 'papa'>('mama')
  const [link, setLink] = useState('')
  const [joinRole, setJoinRole] = useState<'mama' | 'papa' | 'grandma' | 'grandpa'>('mama')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (!identity) return null
  const token = identity.token
  const code = extractCode(link)

  // после успеха запоминаем новую запись и семью на устройстве (id участника мог смениться) и просим данные заново
  async function done(result: MemberFamilyResult) {
    if (!identity) return
    await save({ ...identity, familyCode: result.family.code, memberId: result.member.id, name: result.member.name, role: result.member.role })
    dispatch(api.util.invalidateTags(['Me']))
  }

  const run = guard(async (action: () => Promise<MemberFamilyResult>) => {
    setBusy(true)
    setError(undefined)
    try {
      await done(await action())
    } catch (err) {
      const apiCode = err instanceof ApiError ? err.code : ''
      setError(
        apiCode === 'invite_not_found'
          ? 'Приглашение не найдено. Проверьте ссылку.'
          : apiCode === 'name_taken'
            ? 'В той семье уже есть участник с таким именем. Попросите создателя семьи изменить своё имя или выберите другую ссылку.'
            : describeSignupError(err).text,
      )
    } finally {
      setBusy(false)
    }
  })

  return (
    <AuthScreen>
      <Stack $gap={8}>
        <Title>Вы не состоите в семье</Title>
        <Text $tone="muted">Ваш аккаунт сохранён. Создайте новую семью или присоединитесь к другой по ссылке-приглашению.</Text>
      </Stack>

      <Stack>
        <Heading>Создать семью</Heading>
        <Text $tone="muted">Кто вы в семье</Text>
        <RolePicker roles={CREATE_ROLES} value={createRole} onChange={setCreateRole} />
        <Button variant="primary" disabled={busy} onPress={() => void run(() => createFamilyForMe(token, createRole))}>
          Создать семью
        </Button>
      </Stack>

      <Stack>
        <Heading>Присоединиться по ссылке</Heading>
        <Field label="Ссылка-приглашение или код">
          <Input value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} placeholder="https://…/join?code=…" />
        </Field>
        <Text $tone="muted">Кто вы в этой семье</Text>
        <RolePicker roles={JOIN_ROLES} value={joinRole} onChange={setJoinRole} />
        <Button variant="primary" disabled={busy || !code} onPress={() => void run(() => joinFamilyAsMe(token, code, joinRole))}>
          Присоединиться
        </Button>
      </Stack>

      {error && <Notice tone="error">{error}</Notice>}
      <Button disabled={busy} onPress={() => void clear()}>
        Выйти
      </Button>
    </AuthScreen>
  )
}
