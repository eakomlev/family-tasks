import { useState, type ReactNode } from 'react'
import { useRouter } from 'expo-router'
import { useIdentity } from '@/identity/context'
import { Button } from '../Button'
import { Notice } from '../Notice'
import { Stack } from '../Stack'

// Если на устройстве уже есть вход, просим явно подтвердить его замену
export function ReplaceGuard({ children }: { children: ReactNode }) {
  const { identity } = useIdentity()
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  // вход, появившийся уже во время регистрации, предупреждения не вызывает: смотрим только на состояние при открытии экрана
  const [hadIdentity] = useState(() => !!identity)

  if (!identity || !hadIdentity || confirmed) return <>{children}</>

  return (
    <Stack>
      <Notice tone="warning">
        {`На этом устройстве вы уже вошли как ${identity.name}. Если продолжить, этот вход будет заменён. Вернуться к нему можно будет, войдя по email.`}
      </Notice>
      <Button variant="primary" onPress={() => setConfirmed(true)}>
        Продолжить
      </Button>
      <Button variant="text" onPress={() => router.replace('/')}>
        Отмена
      </Button>
    </Stack>
  )
}
