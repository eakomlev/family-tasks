import { useRouter } from 'expo-router'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { Stack } from '@/components/Stack'
import { Text, Title } from '@/components/Text'

// Приветствие для тех, кто ещё не вошёл. Слайдер знакомства добавится позже.
export default function Welcome() {
  const router = useRouter()
  return (
    <AuthScreen>
      <Stack $gap={8}>
        <Title>Моя Семья</Title>
        <Text $tone="muted">Задания, награды, расписание и чат: всё, чтобы вся семья была на одной волне.</Text>
      </Stack>
      <Stack $gap={8}>
        <Button variant="primary" onPress={() => router.push('/create')}>
          Создать семью
        </Button>
        <Button variant="text" onPress={() => router.push('/join')}>
          У меня есть приглашение
        </Button>
        <Button variant="text" onPress={() => router.push('/login')}>
          Уже есть семья? Войти
        </Button>
      </Stack>
    </AuthScreen>
  )
}
