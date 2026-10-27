import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { createFamilyForMe, joinFamilyAsMe, type MemberFamilyResult } from '@/api'
import { AppLogo, AuthCard, AuthPage } from '@/components/AuthPage'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Notice } from '@/components/Notice'
import { Select } from '@/components/Select'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { useInFlight } from '@/lib/useInFlight'
import { CREATOR_ROLES, ROLE_LABELS, type Role } from '@/lib/roles'
import { extractCode } from '@/pages/Join/components/EnterCode/utils'
import { describeSignupError } from '@/components/RoleForm/utils'
import { api } from '@/store/api'

// кем взрослый может вступить в чужую семью (ребёнком нельзя: у ребёнка нет своего аккаунта без родителей)
const JOIN_ROLES: Role[] = ['mama', 'papa', 'grandma', 'grandpa']

// Экран для участника без семьи (создатель убрал его из семьи): аккаунт и вход остались, нужно создать новую семью или вступить в другую по ссылке.
// Закрывает приложение, пока человек не выбрал; «Выйти» выходит на этом устройстве.
export function NoFamilyGate() {
  const guard = useInFlight()
  const dispatch = useDispatch()
  const { identity, save, clear } = useIdentity()
  const [createRole, setCreateRole] = useState<Role>('mama')
  const [link, setLink] = useState('')
  const [joinRole, setJoinRole] = useState<Role>('mama')
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
      const apiCode = (err as { code?: string }).code
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
    <AuthPage>
      <AppLogo />
      <h1>Вы не состоите в семье</h1>
      <AuthCard>
        <Stack>
          <p>Ваш аккаунт сохранён. Создайте новую семью или присоединитесь к другой по ссылке-приглашению.</p>

          <h2>Создать семью</h2>
          <Field label="Кто вы в семье">
            <Select value={createRole} onChange={(e) => setCreateRole(e.target.value as Role)}>
              {CREATOR_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
          </Field>
          <Button $variant="primary" type="button" disabled={busy} onClick={() => void run(() => createFamilyForMe(token, createRole as 'mama' | 'papa'))}>
            Создать семью
          </Button>

          <h2>Присоединиться по ссылке</h2>
          <Field label="Ссылка-приглашение или код">
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…/join?code=…" />
          </Field>
          <Field label="Кто вы в этой семье">
            <Select value={joinRole} onChange={(e) => setJoinRole(e.target.value as Role)}>
              {JOIN_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
          </Field>
          <Button $variant="primary" type="button" disabled={busy || !code} onClick={() => void run(() => joinFamilyAsMe(token, code, joinRole as 'mama' | 'papa' | 'grandma' | 'grandpa'))}>
            Присоединиться
          </Button>

          {error && <Notice $tone="error">{error}</Notice>}
          <Button type="button" disabled={busy} onClick={() => void clear()}>Выйти</Button>
        </Stack>
      </AuthCard>
    </AuthPage>
  )
}
