import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useIdentity } from '@/identity/context'
import { Actions, Hero, Logo, WelcomePage } from './styles'
import { START_PATH } from '@/lib/routes'

export default function Welcome() {
  const { identity } = useIdentity()
  if (identity) return <Navigate to={START_PATH} replace />

  return (
    <WelcomePage>
      <Hero>
        <Logo aria-hidden>✓</Logo>
        <h1>Моя Семья</h1>
        <p>Задания, расписание, чат и дни рождения всей семьи в одном месте: кто что делает, что уже готово и что ждёт своей очереди.</p>
      </Hero>
      <Actions>
        <Button as={Link} to="/create" $variant="primary">Создать семью</Button>
        <Button as={Link} to="/join" $variant="text">У меня есть приглашение</Button>
        <Button as={Link} to="/login" $variant="text">Уже есть семья? Войти</Button>
      </Actions>
    </WelcomePage>
  )
}
