import { request, send } from '../client'
import type { ChatMessage, ChatSummary, MessageFeedback, MessagePage } from './types'

export const FAMILY_CHAT = 'family'

// все чаты, свежая активность выше
export const listChats = (token: string) => request<{ chats: ChatSummary[] }>('/chats', {}, token)

// before — id самого старого уже загруженного сообщения (чтобы получить более старые)
export const listMessages = (token: string, chat: string, before?: string) =>
  request<MessagePage>(`/chats/${chat}/messages${before ? `?before=${before}` : ''}`, {}, token)

// text может быть пустым, если есть фото (mediaIds из uploadChatPhoto, в порядке показа)
export const sendMessage = (token: string, chat: string, text: string, mediaIds?: string[]) =>
  request<{ message: ChatMessage }>(`/chats/${chat}/messages`, send('POST', mediaIds?.length ? { text, mediaIds } : { text }), token)

// Загрузка одного фото (JPEG, уже уменьшенного на устройстве) для будущего сообщения; к сообщению оно прикрепляется через mediaIds
export const uploadChatPhoto = (token: string, chat: string, photo: Blob) =>
  request<{ mediaId: string; width: number; height: number }>(
    `/chats/${chat}/media`,
    { method: 'POST', body: photo, headers: { 'Content-Type': 'image/jpeg' } },
    token,
  )

// Реакция и/или монеты родителя на сообщение ребёнка; возвращает сообщение с обновлёнными реакциями и начислениями
export const giveFeedback = (token: string, chat: string, messageId: string, feedback: MessageFeedback) =>
  request<{ message: ChatMessage }>(`/chats/${chat}/messages/${messageId}/feedback`, send('POST', feedback), token)

export const markChatRead = (token: string, chat: string) => request<void>(`/chats/${chat}/read`, send('POST'), token)

export type * from './types'
