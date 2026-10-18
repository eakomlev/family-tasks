import { useRouter } from 'expo-router'
import { AuthScreen } from '@/components/AuthScreen'
import { Button } from '@/components/Button'
import { Title } from '@/components/Text'
import { LoginFlow } from '@/features/auth/LoginFlow'

export default function Login() {
  const router = useRouter()
  return (
    <AuthScreen>
      <Button variant="text" onPress={() => router.back()}>
        ← Назад
      </Button>
      <Title>С возвращением!</Title>
      <LoginFlow />
    </AuthScreen>
  )
}
