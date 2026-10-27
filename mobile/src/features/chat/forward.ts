import type { ChatMessage } from '@/api'

// Текст сообщения для копирования и пересылки (без заглушек вроде «📷 Фото»): у сообщения только с вложениями текста нет
export const messageText = (message: ChatMessage): string => message.caption.trim()

// Пересылка отправляет текст с пометкой, от кого он (вложения не пересылаются)
export const forwardedText = (message: ChatMessage, authorName: string): string => `Переслано от ${authorName}:\n${messageText(message)}`

// Пересылаемый текст между меню сообщения и экраном выбора чата (как в lib/incomingShare: хранится вне экранов)
let pendingForward: string | null = null
export const setPendingForward = (text: string | null) => {
  pendingForward = text
}
export const getPendingForward = () => pendingForward
