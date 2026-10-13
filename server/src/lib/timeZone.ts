// Известен ли среде выполнения часовой пояс (IANA, например Europe/Moscow).
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}
