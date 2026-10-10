import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import type { ReplaceGuardProps } from './types'

// если на устройстве уже есть вход, просим явно подтвердить его замену
export function ReplaceGuard({ children }: ReplaceGuardProps) {
  const { identity } = useIdentity()
  const [confirmed, setConfirmed] = useState(false)

  if (!identity || confirmed) return <>{children}</>

  return (
    <Stack>
      <Notice $tone="warning">
        На этом устройстве вы уже вошли как <strong>{identity.name}</strong>. Если продолжить, этот вход будет заменён.
        Вернуться к нему можно будет, войдя по email.
      </Notice>
      <Button $variant="danger" type="button" onClick={() => setConfirmed(true)}>
        Всё равно продолжить
      </Button>
      <Button as={Link} to="/family">Остаться как сейчас</Button>
    </Stack>
  )
}
