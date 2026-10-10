export const inviteLink = (code: string) =>
  `${window.location.origin}/join?code=${encodeURIComponent(code)}`

export const recoveryLink = (code: string) =>
  `${window.location.origin}/recover?code=${encodeURIComponent(code)}`

export function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}
