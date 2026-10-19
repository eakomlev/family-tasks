// Какой чат сейчас открыт на экране (null — никакой). Нужен не только серверу (он не шлёт пуши открытому чату), но и самому приложению:
// сокет мог тихо оборваться после фона, и сервер тогда считает чат закрытым, поэтому пуш всё равно придёт, а показывать его не надо.
let current: string | null = null

export function setViewingChat(chat: string | null) {
  current = chat
}

export function getViewingChat() {
  return current
}

// Пуш о сообщении чата ведёт на /chat/<чат>: если этот чат открыт, уведомление лишнее
export function isChatOpenFor(url: string | null) {
  return !!current && url === `/chat/${current}`
}
