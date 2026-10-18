// Принимает и полную ссылку-приглашение, и просто код
export function extractCode(input: string): string {
  const value = input.trim()
  const match = /[?&]code=([^&#\s]+)/.exec(value)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }
  return value
}
