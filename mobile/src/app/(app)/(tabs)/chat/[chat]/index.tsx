import { useLocalSearchParams } from 'expo-router'
import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen'

// key: у каждого чата своё состояние (подгруженные страницы, черновик)
export default function Room() {
  const { chat } = useLocalSearchParams<{ chat: string }>()
  return <ChatRoomScreen key={chat} chat={chat} />
}
