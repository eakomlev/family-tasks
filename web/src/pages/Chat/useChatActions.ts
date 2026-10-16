import { useNavigate } from 'react-router-dom'
import { useConfirm } from '@/components/ConfirmDialog/context'
import type { SheetAction } from '@/components/ActionSheet/types'
import { FAMILY_CHAT } from '@/api'
import { useChats } from '@/chat/context'
import { useIdentity } from '@/identity/context'
import { useProfile } from '@/profile/context'
import { toApiError } from '@/store/api'
import { useClearChatMutation, useSetChatMutedMutation } from '@/store/chat'
import { chatTitle } from './utils'

// Действия над чатом для меню (три точки в переписке, долгое нажатие в списке): все фото чата («Медиа файлы»), отключить или включить уведомления (всем)
// и очистить чат (только родителям, у всех участников, безвозвратно).
export function useChatActions(chat: string): SheetAction[] {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { identity } = useIdentity()
  const { data } = useProfile()
  const { chats } = useChats()
  const [setMuted] = useSetChatMutedMutation()
  const [clear] = useClearChatMutation()

  const muted = chats?.find((c) => c.id === chat)?.muted ?? false
  const isParent = identity?.role === 'mama' || identity?.role === 'papa'
  const title = identity ? chatTitle(chat, data?.members ?? [], identity.role) : ''

  const actions: SheetAction[] = [
    { key: 'media', label: 'Медиа файлы', onSelect: () => navigate(`/chat/${chat}/media`) },
    {
      key: 'mute',
      label: muted ? 'Включить уведомления' : 'Отключить уведомления',
      onSelect: async () => {
        await setMuted({ chat, muted: !muted }).unwrap().catch(toApiError)
      },
    },
  ]
  if (isParent) {
    actions.push({
      key: 'clear',
      label: 'Очистить чат',
      danger: true,
      onSelect: async () => {
        const ok = await confirm({
          title: 'Очистить чат?',
          message:
            chat === FAMILY_CHAT
              ? 'Все сообщения и фото общего чата будут удалены у всех участников. Это нельзя отменить.'
              : `Вся переписка с «${title}» (сообщения и фото) будет удалена у вас обоих. Это нельзя отменить.`,
          confirmLabel: 'Очистить',
          danger: true,
        })
        if (ok) await clear(chat).unwrap().catch(toApiError)
      },
    })
  }
  return actions
}
