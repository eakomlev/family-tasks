import { ActionSheet } from '@/components/ActionSheet'
import { useChats } from '@/chat/context'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { chatTitle } from '../../utils'
import { useChatActions } from '../../useChatActions'

// Меню чата: монтируется только пока открыто (три точки в переписке, долгое нажатие на строке списка)
export function ChatMenu({ chat, onClose }: { chat: string; onClose: () => void }) {
  const actions = useChatActions(chat)
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  return <ActionSheet title={identity ? chatTitle(chat, data?.members ?? [], identity.role, chats?.find((c) => c.id === chat)?.event?.title) : undefined} actions={actions} onClose={onClose} />
}
