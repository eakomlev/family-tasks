import { ActionSheet } from '@/components/ActionSheet'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { chatTitle } from '../../utils'
import { useChatActions } from '../../useChatActions'

// Меню чата: монтируется только пока открыто (три точки в переписке, долгое нажатие на строке списка)
export function ChatMenu({ chat, onClose }: { chat: string; onClose: () => void }) {
  const actions = useChatActions(chat)
  const { identity } = useIdentity()
  const { data } = useProfile()
  return <ActionSheet title={identity ? chatTitle(chat, data?.members ?? [], identity.role) : undefined} actions={actions} onClose={onClose} />
}
