import { useLocalSearchParams } from 'expo-router'
import { ChatInfoScreen } from '@/features/chat/ChatInfoScreen'

export default function ChatInfo() {
  const { chat } = useLocalSearchParams<{ chat: string }>()
  return <ChatInfoScreen key={chat} chat={chat} />
}
