import { useRouter } from 'expo-router'
import { createFamily, type SignupData } from '@/api'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { ReplaceGuard } from '@/components/ReplaceGuard'
import { Title } from '@/components/Text'
import { RoleForm } from '@/features/auth/RoleForm'
import { useIdentity } from '@/identity/context'
import { toIdentity } from '@/identity/utils'
import { CREATOR_ROLES } from '@/lib/roles'

// Создание семьи: мама или папа. Лежит вне групп экранов, чтобы сохранённый вход не уводил сразу на «Мой день»:
// сначала показываем «Семья создана» со ссылкой-приглашением.
export default function CreateFamily() {
  const { save } = useIdentity()
  const router = useRouter()

  async function handleSubmit(data: SignupData) {
    const res = await createFamily(data)
    // сначала переход, потом вход: иначе группа экранов вошедшего перехватила бы навигацию
    router.replace({ pathname: '/created', params: { code: res.invite.code, expiresAt: res.invite.expiresAt } })
    await save(toIdentity(res))
  }

  return (
    <AuthScreen>
      <Button variant="text" onPress={() => router.back()}>
        ← Назад
      </Button>
      <Title>Создаём семью</Title>
      <ReplaceGuard>
        <RoleForm roles={CREATOR_ROLES} submitLabel="Создать семью" onSubmit={handleSubmit} />
      </ReplaceGuard>
    </AuthScreen>
  )
}
