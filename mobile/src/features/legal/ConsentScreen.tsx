import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { acceptConsent } from '@/api'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { useInFlight } from '@/lib/useInFlight'
import { api } from '@/store/api'
import { ConsentCheck } from './ConsentCheck'

// Экран согласия на обработку персональных данных для тех, кто зарегистрировался раньше или кому нужно подтвердить обновлённую редакцию.
// Закрывает приложение, пока человек не согласился или не вышел.
export function ConsentScreen() {
  const guard = useInFlight()
  const dispatch = useDispatch()
  const { identity, clear } = useIdentity()
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (!identity) return null
  const token = identity.token

  const accept = guard(async () => {
    if (!checked) return
    setBusy(true)
    setError(undefined)
    try {
      await acceptConsent(token)
      dispatch(api.util.invalidateTags(['Me']))
    } catch {
      setError('Не удалось сохранить согласие. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  })

  return (
    <AuthScreen>
      <Stack $gap={8}>
        <Title>Согласие на обработку данных</Title>
        <Text $tone="muted">Чтобы продолжить пользоваться «Моей Семьёй», нужно дать согласие на обработку персональных данных. Без него мы не можем хранить ваши данные.</Text>
      </Stack>
      <Stack>
        <ConsentCheck checked={checked} onChange={setChecked} />
        {error && <Notice tone="error">{error}</Notice>}
        <Button variant="primary" disabled={!checked || busy} onPress={accept}>
          {busy ? 'Подождите…' : 'Согласен, продолжить'}
        </Button>
        <Button disabled={busy} onPress={() => void clear()}>
          Выйти
        </Button>
      </Stack>
    </AuthScreen>
  )
}
