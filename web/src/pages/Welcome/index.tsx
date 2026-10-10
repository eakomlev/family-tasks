import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useIdentity } from '@/identity/context'
import { Actions, Hero, Logo, WelcomePage } from './styles'

export default function Welcome() {
  const { identity } = useIdentity()
  if (identity) return <Navigate to="/tasks" replace />

  return (
    <WelcomePage>
      <Hero>
        <Logo aria-hidden>✓</Logo>
        <h1>Семейные задачи</h1>
        <p>Один общий список дел для всей семьи: кто что делает, что уже готово и что ждёт своей очереди.</p>
      </Hero>
      <Actions>
        <Button as={Link} to="/create" $variant="primary">Создать семью</Button>
        <Button as={Link} to="/join" $variant="text">У меня есть приглашение</Button>
        <Button as={Link} to="/login" $variant="text">Уже есть семья? Войти</Button>
      </Actions>
    </WelcomePage>
  )
}
