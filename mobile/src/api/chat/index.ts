import { request, send } from '../client'
import type { ChatMediaItem, ChatMessage, ChatSummary, MessageFeedback, MessagePage } from './types'

export const FAMILY_CHAT = 'family'

// все чаты, свежая активность выше
export const listChats = (token: string) => request<{ chats: ChatSummary[] }>('/chats', {}, token)

// before — id самого старого уже загруженного сообщения (чтобы получить более старые)
export const listMessages = (token: string, chat: string, before?: string) =>
  request<MessagePage>(`/chats/${chat}/messages${before ? `?before=${before}` : ''}`, {}, token)

// Все фото чата, свежие первыми; before — id самого старого уже загруженного фото
export const listChatMedia = (token: string, chat: string, before?: string) =>
  request<{ items: ChatMediaItem[]; hasMore: boolean }>(`/chats/${chat}/media${before ? `?before=${before}` : ''}`, {}, token)

// text может быть пустым, если есть фото (mediaIds из uploadChatPhoto, в порядке показа)
export const sendMessage = (token: string, chat: string, text: string, mediaIds?: string[], fileIds?: string[]) =>
  request<{ message: ChatMessage }>(
    `/chats/${chat}/messages`,
    send('POST', { text, ...(mediaIds?.length ? { mediaIds } : {}), ...(fileIds?.length ? { fileIds } : {}) }),
    token,
  )

// Загрузка одного фото (JPEG, уже уменьшенного на устройстве) для будущего сообщения; к сообщению оно прикрепляется через mediaIds
export const uploadChatPhoto = (token: string, chat: string, photo: Blob) =>
  request<{ mediaId: string; width: number; height: number }>(
    `/chats/${chat}/media`,
    { method: 'POST', body: photo, headers: { 'Content-Type': 'image/jpeg' } },
    token,
  )

// Загрузка одного файла (документ, архив…, до 10 МБ) для будущего сообщения; к сообщению он прикрепляется через fileIds.
// Имя уходит в заголовке в процентной записи (в заголовках нет кириллицы).
export const uploadChatFile = (token: string, chat: string, file: File) =>
  request<{ fileId: string; name: string; size: number }>(
    `/chats/${chat}/files`,
    { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) } },
    token,
  )

// Реакция и/или монеты родителя на сообщение ребёнка; возвращает сообщение с обновлёнными реакциями и начислениями
export const giveFeedback = (token: string, chat: string, messageId: string, feedback: MessageFeedback) =>
  request<{ message: ChatMessage }>(`/chats/${chat}/messages/${messageId}/feedback`, send('POST', feedback), token)

export const markChatRead = (token: string, chat: string) => request<void>(`/chats/${chat}/read`, send('POST'), token)

// Уведомления чата: отключить или включить (только для себя, на всех своих устройствах)
export const setChatMuted = (token: string, chat: string, muted: boolean) => request<void>(`/chats/${chat}/mute`, send('PUT', { muted }), token)

// Очистка чата: удаляет все сообщения и фото у всех участников, безвозвратно (только родитель)
export const clearChat = (token: string, chat: string) => request<void>(`/chats/${chat}/messages`, { method: 'DELETE' }, token)

export type * from './types'
