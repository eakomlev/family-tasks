import { Redirect, Stack } from 'expo-router'
import { useIdentity } from '@/identity/context'

// Экраны для тех, кто ещё не вошёл: вошедшего сразу отправляем на «Мой день»
export default function AuthLayout() {
  const { identity } = useIdentity()
  if (identity) return <Redirect href="/" />
  return <Stack screenOptions={{ headerShown: false }} />
}
