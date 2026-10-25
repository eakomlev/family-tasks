import { request, send } from '../client'
import type { ChatLink, ChatMediaItem, ChatSearchResult, ChatMessage, ChatSummary, MessageFeedback, MessagePage } from './types'

export const FAMILY_CHAT = 'family'

// Чат события календаря: в адресе «event-<id события>»
export const EVENT_CHAT_PREFIX = 'event-'
export const eventChatId = (eventId: string) => `${EVENT_CHAT_PREFIX}${eventId}`
export const isEventChat = (chat: string) => chat.startsWith(EVENT_CHAT_PREFIX)

// все чаты, свежая активность выше
export const listChats = (token: string) => request<{ chats: ChatSummary[] }>('/chats', {}, token)

// before — id самого старого уже загруженного сообщения (чтобы получить более старые)
export const listMessages = (token: string, chat: string, before?: string) =>
  request<MessagePage>(`/chats/${chat}/messages${before ? `?before=${before}` : ''}`, {}, token)

// Все фото чата, свежие первыми; before — id самого старого уже загруженного фото
export const listChatMedia = (token: string, chat: string, before?: string) =>
  request<{ items: ChatMediaItem[]; hasMore: boolean }>(`/chats/${chat}/media${before ? `?before=${before}` : ''}`, {}, token)

// Поиск сообщений чата по тексту, свежие первыми; before — id самого старого найденного
export const searchChatMessages = (token: string, chat: string, query: string, before?: string) =>
  request<{ messages: ChatSearchResult[]; hasMore: boolean }>(`/chats/${chat}/search?q=${encodeURIComponent(query)}${before ? `&before=${before}` : ''}`, {}, token)

// Все ссылки из сообщений чата, свежие первыми; before — lastMessageId прошлой страницы
export const listChatLinks = (token: string, chat: string, before?: string) =>
  request<{ items: ChatLink[]; hasMore: boolean; lastMessageId: string | null }>(`/chats/${chat}/links${before ? `?before=${before}` : ''}`, {}, token)

// text может быть пустым, если есть фото (mediaIds из uploadChatPhoto, в порядке показа)
export const sendMessage = (token: string, chat: string, text: string, mediaIds?: string[], fileIds?: string[], replyTo?: string, videoIds?: string[]) =>
  request<{ message: ChatMessage }>(
    `/chats/${chat}/messages`,
    send('POST', { text, ...(mediaIds?.length ? { mediaIds } : {}), ...(fileIds?.length ? { fileIds } : {}), ...(videoIds?.length ? { videoIds } : {}), ...(replyTo ? { replyTo } : {}) }),
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

// Загрузка одного видео (до 100 МБ и 3 минут) для будущего сообщения; к сообщению оно прикрепляется через videoIds.
// Сервер сжимает видео перед ответом, поэтому ждать приходится дольше, чем фото. Тип берётся из файла (у .mov это video/quicktime).
export const uploadChatVideo = (token: string, chat: string, video: File, contentType: string) =>
  request<{ videoId: string; width: number; height: number; duration: number }>(
    `/chats/${chat}/videos`,
    { method: 'POST', body: video, headers: { 'Content-Type': contentType } },
    token,
  )

// Реакция и/или монеты родителя на сообщение ребёнка; возвращает сообщение с обновлёнными реакциями и начислениями
export const giveFeedback = (token: string, chat: string, messageId: string, feedback: MessageFeedback) =>
  request<{ message: ChatMessage }>(`/chats/${chat}/messages/${messageId}/feedback`, send('POST', feedback), token)

// Правка текста своего сообщения
export const editMessage = (token: string, chat: string, messageId: string, text: string) =>
  request<{ message: ChatMessage }>(`/chats/${chat}/messages/${messageId}`, send('PATCH', { text }), token)

// Удаление своего сообщения у всех участников
export const deleteMessage = (token: string, chat: string, messageId: string) => request<void>(`/chats/${chat}/messages/${messageId}`, { method: 'DELETE' }, token)

export const markChatRead = (token: string, chat: string) => request<void>(`/chats/${chat}/read`, send('POST'), token)

// Уведомления чата: отключить или включить (только для себя, на всех своих устройствах)
export const setChatMuted = (token: string, chat: string, muted: boolean) => request<void>(`/chats/${chat}/mute`, send('PUT', { muted }), token)

// В архив и обратно (только для себя, на всех своих устройствах)
export const setChatArchived = (token: string, chat: string, archived: boolean) => request<void>(`/chats/${chat}/archive`, send('PUT', { archived }), token)

// Очистка чата: удаляет все сообщения и фото у всех участников, безвозвратно (только родитель)
export const clearChat = (token: string, chat: string) => request<void>(`/chats/${chat}/messages`, { method: 'DELETE' }, token)

export type * from './types'
