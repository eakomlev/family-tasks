import { useRouter } from 'expo-router'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Heading, Text } from '@/components/Text'
import { getPendingForward, setPendingForward } from '@/features/chat/forward'
import { emptyShared, setPendingShare } from '@/lib/incomingShare'
import { goBack } from '@/lib/navigation'
import { ChatPicker } from './ChatPicker'

// Пересылка сообщения: выбираем чат, куда оно уйдёт. Выбранный чат открывается с текстом в поле ввода (как при «Поделиться»),
// можно дописать и нажать «Отправить».
export function ForwardScreen() {
  const router = useRouter()
  const text = getPendingForward()

  const choose = (chat: string) => {
    setPendingShare({ ...emptyShared(), text: text ?? '' })
    setPendingForward(null)
    router.replace({ pathname: '/chat/[chat]', params: { chat } })
  }

  return (
    <Screen header={<PageHeader fallback="/chat">Переслать</PageHeader>}>
      {!text ? (
        <Notice>Нечего пересылать.</Notice>
      ) : (
        <>
          <Text numberOfLines={4}>{text}</Text>
          <Heading>В какой чат отправить?</Heading>
          <ChatPicker onChoose={choose} />
        </>
      )}
      <Button onPress={() => goBack(router, '/chat')}>Отмена</Button>
    </Screen>
  )
}
