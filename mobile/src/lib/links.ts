import { API_URL } from './config'

export const inviteLink = (code: string) =>
  `${API_URL}/join?code=${encodeURIComponent(code)}`

export function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}
