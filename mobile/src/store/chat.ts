import { clearChat, deleteMessage, editMessage, giveFeedback, listChats, listMessages, markChatRead, sendMessage, setChatArchived, setChatMuted, type ChatMessage, type ChatSummary, type MessageFeedback, type MessagePage } from '@/api'
import { api, fromApi } from './api'

interface SendArgs {
  chat: string
  text: string
  mediaIds?: string[]
  fileIds?: string[]
  videoIds?: string[]
  // id сообщения, на которое отвечаем
  replyTo?: string
}

// Чаты. Список чатов (с непрочитанным и последним сообщением) и свежая первая страница переписки лежат в кэше:
// после перезапуска они видны сразу. Старые страницы переписки экран подгружает сам и держит у себя.
export const chatApi = api.injectEndpoints({
  endpoints: (build) => ({
    listChats: build.query<{ chats: ChatSummary[] }, void>({
      queryFn: fromApi((token) => listChats(token)),
      providesTags: ['Chats'],
    }),
    getMessages: build.query<MessagePage, string>({
      queryFn: fromApi((token, chat: string) => listMessages(token, chat)),
      providesTags: (_result, _error, chat) => [{ type: 'Messages', id: chat }],
    }),

    // Своё сообщение сразу ложится в кэш переписки, список чатов обновляется после
    sendMessage: build.mutation<{ message: ChatMessage }, SendArgs>({
      queryFn: fromApi((token, { chat, text, mediaIds, fileIds, videoIds, replyTo }: SendArgs) => sendMessage(token, chat, text, mediaIds, fileIds, replyTo, videoIds)),
      async onQueryStarted({ chat }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(
            chatApi.util.updateQueryData('getMessages', chat, (draft) => {
              if (!draft.messages.some((m) => m.id === data.message.id)) draft.messages.push(data.message)
            }),
          )
        } catch {
          /* ошибку показывает поле ввода */
        }
      },
      invalidatesTags: ['Chats'],
    }),
    // Реакция или монеты: сообщение с новыми реакциями заменяет прежнее в кэше
    giveFeedback: build.mutation<{ message: ChatMessage }, { chat: string; messageId: string; feedback: MessageFeedback }>({
      queryFn: fromApi((token, { chat, messageId, feedback }: { chat: string; messageId: string; feedback: MessageFeedback }) =>
        giveFeedback(token, chat, messageId, feedback),
      ),
      async onQueryStarted({ chat }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(
            chatApi.util.updateQueryData('getMessages', chat, (draft) => {
              const i = draft.messages.findIndex((m) => m.id === data.message.id)
              if (i >= 0) draft.messages[i] = data.message
            }),
          )
        } catch {
          /* ошибку показывает окно реакции */
        }
      },
    }),
    // Правка своего сообщения: новое сообщение заменяет прежнее в кэше
    editMessage: build.mutation<{ message: ChatMessage }, { chat: string; messageId: string; text: string }>({
      queryFn: fromApi((token, { chat, messageId, text }: { chat: string; messageId: string; text: string }) => editMessage(token, chat, messageId, text)),
      async onQueryStarted({ chat }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(
            chatApi.util.updateQueryData('getMessages', chat, (draft) => {
              const i = draft.messages.findIndex((m) => m.id === data.message.id)
              if (i >= 0) draft.messages[i] = data.message
            }),
          )
        } catch {
          /* ошибку показывает экран */
        }
      },
      invalidatesTags: (_result, error) => (error ? [] : ['Chats']),
    }),
    // Удаление своего сообщения: пропадает из кэша переписки сразу после ответа сервера
    deleteMessage: build.mutation<void, { chat: string; messageId: string }>({
      queryFn: fromApi((token, { chat, messageId }: { chat: string; messageId: string }) => deleteMessage(token, chat, messageId)),
      async onQueryStarted({ chat, messageId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(
            chatApi.util.updateQueryData('getMessages', chat, (draft) => {
              draft.messages = draft.messages.filter((m) => m.id !== messageId)
            }),
          )
        } catch {
          /* ошибку показывает экран */
        }
      },
      invalidatesTags: (_result, error) => (error ? [] : ['Chats']),
    }),
    // Прочитано: непрочитанное в списке чатов и значок на табе пересчитываются
    markChatRead: build.mutation<void, string>({
      queryFn: fromApi((token, chat: string) => markChatRead(token, chat)),
      invalidatesTags: ['Chats'],
    }),
    // Уведомления чата: переключатель в списке меняется сразу, при ошибке возвращается
    setChatMuted: build.mutation<void, { chat: string; muted: boolean }>({
      queryFn: fromApi((token, { chat, muted }: { chat: string; muted: boolean }) => setChatMuted(token, chat, muted)),
      async onQueryStarted({ chat, muted }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          chatApi.util.updateQueryData('listChats', undefined, (draft) => {
            const item = draft.chats.find((c) => c.id === chat)
            if (item) item.muted = muted
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),
    // В архив и обратно: чат уходит из списка (или возвращается) сразу, при ошибке возвращается как был
    setChatArchived: build.mutation<void, { chat: string; archived: boolean }>({
      queryFn: fromApi((token, { chat, archived }: { chat: string; archived: boolean }) => setChatArchived(token, chat, archived)),
      async onQueryStarted({ chat, archived }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          chatApi.util.updateQueryData('listChats', undefined, (draft) => {
            const item = draft.chats.find((c) => c.id === chat)
            if (item) item.archived = archived
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),
    // Очистка чата: переписка в кэше пустеет сразу, список чатов запрашивается заново
    clearChat: build.mutation<void, string>({
      queryFn: fromApi((token, chat: string) => clearChat(token, chat)),
      async onQueryStarted(chat, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(
            chatApi.util.updateQueryData('getMessages', chat, (draft) => {
              draft.messages = []
              draft.hasMore = false
            }),
          )
        } catch {
          /* ошибку показывает меню */
        }
      },
      invalidatesTags: (_result, error, chat) => (error ? [] : ['Chats', { type: 'Messages', id: chat }]),
    }),
  }),
})

export const { useListChatsQuery, useGetMessagesQuery, useSendMessageMutation, useEditMessageMutation, useDeleteMessageMutation, useGiveFeedbackMutation, useMarkChatReadMutation, useSetChatMutedMutation, useSetChatArchivedMutation, useClearChatMutation } = chatApi
