import { Redirect } from 'expo-router'
import { useIdentity } from '@/identity/context'
import { ThemedStack } from '@/components/ThemedStack'

// Экраны для тех, кто ещё не вошёл: вошедшего сразу отправляем на «Мой день»
export default function AuthLayout() {
  const { identity } = useIdentity()
  if (identity) return <Redirect href="/" />
  return <ThemedStack />
}
