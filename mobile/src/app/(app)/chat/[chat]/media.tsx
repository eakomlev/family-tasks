import { useLocalSearchParams } from 'expo-router'
import { ChatMediaScreen } from '@/features/chat/ChatMediaScreen'

export default function ChatMedia() {
  const { chat } = useLocalSearchParams<{ chat: string }>()
  return <ChatMediaScreen chat={chat} />
}
