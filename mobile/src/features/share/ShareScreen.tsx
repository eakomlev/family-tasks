import { useMemo } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useIncomingShare } from 'expo-sharing'
import { useTheme } from 'styled-components/native'
import { Button } from '@/components/Button'
import { Notice } from '@/components/Notice'
import { PageHeader } from '@/components/PageHeader'
import { Screen } from '@/components/Screen'
import { Heading, Text } from '@/components/Text'
import { useIdentity } from '@/identity/context'
import { classifyShared, describeShared, hasShared, setPendingShare } from '@/lib/incomingShare'
import { goBack } from '@/lib/navigation'
import { ChatPicker } from './ChatPicker'

// «Поделиться» из другого приложения: что получили и в какой чат это отправить. Выбранный чат открывается, а полученное
// (текст, фото, файлы) ложится в его поле ввода: можно дописать подпись и нажать «Отправить».
export function ShareScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { identity } = useIdentity()
  const { resolvedSharedPayloads, sharedPayloads, isResolving, error, clearSharedPayloads } = useIncomingShare()

  const content = useMemo(() => classifyShared(resolvedSharedPayloads), [resolvedSharedPayloads])

  if (!identity) return null

  const cancel = () => {
    clearSharedPayloads()
    goBack(router, '/chat')
  }

  const choose = (chat: string) => {
    setPendingShare(content)
    clearSharedPayloads()
    router.replace({ pathname: '/chat/[chat]', params: { chat } })
  }

  const nothing = sharedPayloads.length === 0 && !isResolving
  const failed = !!error || (!isResolving && sharedPayloads.length > 0 && !hasShared(content))

  return (
    <Screen header={<PageHeader fallback="/chat">Поделиться</PageHeader>}>
      {nothing && <Notice>Нечего отправлять. Выберите фото, файл или текст в другом приложении и нажмите «Поделиться».</Notice>}
      {isResolving && <Text $tone="muted">Читаю, чем вы поделились…</Text>}
      {failed && <Notice tone="error">Не удалось прочитать то, чем вы поделились.</Notice>}
      {hasShared(content) && (
        <>
          <View style={{ gap: 4, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text $tone="muted" $size={13}>
              Вы делитесь
            </Text>
            <Text $weight="extraBold">{describeShared(content)}</Text>
          </View>
          <Heading>В какой чат отправить?</Heading>
          <ChatPicker onChoose={choose} />
        </>
      )}
      <Button onPress={cancel}>Отмена</Button>
    </Screen>
  )
}
