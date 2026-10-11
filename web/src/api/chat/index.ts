import { request, send } from '../client'
import type { ChatMessage, ChatSummary, MessagePage } from './types'

export const FAMILY_CHAT = 'family'

// все чаты, свежая активность выше
export const listChats = (token: string) => request<{ chats: ChatSummary[] }>('/chats', {}, token)

// before — id самого старого уже загруженного сообщения (чтобы получить более старые)
export const listMessages = (token: string, chat: string, before?: string) =>
  request<MessagePage>(`/chats/${chat}/messages${before ? `?before=${before}` : ''}`, {}, token)

export const sendMessage = (token: string, chat: string, text: string) =>
  request<{ message: ChatMessage }>(`/chats/${chat}/messages`, send('POST', { text }), token)

export const markChatRead = (token: string, chat: string) => request<void>(`/chats/${chat}/read`, send('POST'), token)

export type * from './types'
