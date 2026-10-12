import { giveFeedback, listChats, listMessages, markChatRead, sendMessage, type ChatMessage, type ChatSummary, type MessageFeedback, type MessagePage } from '@/api'
import { api, fromApi } from './api'

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
    sendMessage: build.mutation<{ message: ChatMessage }, { chat: string; text: string }>({
      queryFn: fromApi((token, { chat, text }: { chat: string; text: string }) => sendMessage(token, chat, text)),
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
    // Прочитано: непрочитанное в списке чатов и значок на табе пересчитываются
    markChatRead: build.mutation<void, string>({
      queryFn: fromApi((token, chat: string) => markChatRead(token, chat)),
      invalidatesTags: ['Chats'],
    }),
  }),
})

export const { useListChatsQuery, useGetMessagesQuery, useSendMessageMutation, useGiveFeedbackMutation, useMarkChatReadMutation } = chatApi
