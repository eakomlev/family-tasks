import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AppLogo, AuthPage } from '@/components/AuthPage'
import { Button } from '@/components/Button'
import { useIdentity } from '@/identity/context'
import { markOnboardingSkipped, shouldShowOnboarding } from '@/lib/onboarding'
import { START_PATH } from '@/lib/routes'
import { Onboarding } from './components/Onboarding'
import { Actions, Features, Hero } from './styles'

// чип и номер слайда, который он открывает (см. SLIDES)
const FEATURES: [string, number][] = [
  ['✅ Задания', 1],
  ['🪙 Монеты', 2],
  ['💬 Чат', 3],
  ['📅 Расписание', 4],
]

export default function Welcome() {
  const { identity } = useIdentity()
  const navigate = useNavigate()
  const [slides, setSlides] = useState(shouldShowOnboarding)
  // слайдер открыт повторно по нажатию на чип: номер слайда, «Пропустить» возвращает к кнопкам
  const [reopened, setReopened] = useState<number | null>(null)
  if (identity) return <Navigate to={START_PATH} replace />

  function skip() {
    markOnboardingSkipped()
    navigate('/login')
  }

  return (
    <AuthPage bare={slides}>
      {slides ? (
        <Onboarding
          key={reopened ?? 'first'}
          start={reopened ?? 0}
          onSkip={reopened === null ? skip : () => setSlides(false)}
          onDone={() => setSlides(false)}
        />
      ) : (
        <>
          <Hero>
            <AppLogo />
            <h1>Моя Семья</h1>
            <p>Задания, награды, расписание и чат: всё, чтобы вся семья была на одной волне.</p>
            <Features>
              {FEATURES.map(([label, slide]) => (
                <li key={label}>
                  <button type="button" onClick={() => { setReopened(slide); setSlides(true) }}>{label}</button>
                </li>
              ))}
            </Features>
          </Hero>
          <Actions>
            <Button as={Link} to="/create" $variant="primary">Создать семью</Button>
            <Button as={Link} to="/join" $variant="text">У меня есть приглашение</Button>
            <Button as={Link} to="/login" $variant="text">Уже есть семья? Войти</Button>
          </Actions>
        </>
      )}
    </AuthPage>
  )
}
