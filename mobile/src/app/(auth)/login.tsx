import { AuthScreen } from '@/components/AuthScreen'
import { PageHeader } from '@/components/PageHeader'
import { LoginFlow } from '@/features/auth/LoginFlow'

export default function Login() {
  return (
    <AuthScreen showLogo={false}>
      <PageHeader fallback="/(auth)/welcome" reserveRight={false}>С возвращением!</PageHeader>
      <LoginFlow />
    </AuthScreen>
  )
}
