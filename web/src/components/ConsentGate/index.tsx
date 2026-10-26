import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { acceptConsent } from '@/api'
import { AppLogo, AuthCard, AuthPage } from '@/components/AuthPage'
import { Button } from '@/components/Button'
import { ConsentCheck } from '@/components/ConsentCheck'
import { Notice } from '@/components/Notice'
import { Stack } from '@/components/Stack'
import { useIdentity } from '@/identity/context'
import { useInFlight } from '@/lib/useInFlight'
import { api } from '@/store/api'

// Экран согласия на обработку персональных данных для тех, кто зарегистрировался раньше или кому нужно подтвердить обновлённую редакцию.
// Закрывает приложение, пока человек не согласился или не вышел.
export function ConsentGate() {
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
    <AuthPage>
      <AppLogo />
      <h1>Согласие на обработку данных</h1>
      <AuthCard>
        <Stack>
          <p>Чтобы продолжить пользоваться «Моей Семьёй», нужно дать согласие на обработку персональных данных. Без него мы не можем хранить ваши данные.</p>
          <ConsentCheck checked={checked} onChange={setChecked} />
          {error && <Notice $tone="error">{error}</Notice>}
          <Button $variant="primary" type="button" disabled={!checked || busy} onClick={accept}>
            {busy ? 'Подождите…' : 'Согласен, продолжить'}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void clear()}>Выйти</Button>
        </Stack>
      </AuthCard>
    </AuthPage>
  )
}
