export interface InviteByEmailProps {
  token: string
}

export interface Recipient {
  email: string
  // имя из контактов телефона
  name?: string
  status: 'idle' | 'sending' | 'sent'
  // почему не получилось отправить (адрес остаётся в списке, можно повторить)
  error?: string
}
