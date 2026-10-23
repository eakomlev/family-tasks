// Ключ личного чата: id обоих участников по возрастанию, поэтому у собеседников он одинаковый.
export const directKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`)

// Чат события календаря: в адресе API это «event-<id события>», ключ в таблице сообщений «event:<id события>».
// Участники чата те же, кому видно событие (автор, участники или вся семья).
export const EVENT_CHAT_PREFIX = 'event-'
export const eventChatId = (eventId: string) => `${EVENT_CHAT_PREFIX}${eventId}`
export const eventChatKey = (eventId: string) => `event:${eventId}`
export const isEventChat = (chat: string) => chat.startsWith(EVENT_CHAT_PREFIX)
