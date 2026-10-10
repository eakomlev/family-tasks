// принимает и полную ссылку, и просто код
export function extractCode(input: string): string {
  const value = input.trim()
  try {
    return new URL(value).searchParams.get('code') ?? ''
  } catch {
    return value
  }
}
