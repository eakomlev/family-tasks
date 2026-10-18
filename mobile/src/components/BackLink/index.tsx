import { useRouter, type Href } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { Button } from '../Button'

// Ссылка «←»: возвращает на экран, с которого пришли; если истории нет (открыли по ссылке), ведёт на запасной адрес
export function BackLink({ fallback, children = '← Назад' }: { fallback: Href; children?: string }) {
  const router = useRouter()
  return (
    <Button
      variant="text"
      onPress={() => {
        goBack(router, fallback)
      }}
    >
      {children}
    </Button>
  )
}
