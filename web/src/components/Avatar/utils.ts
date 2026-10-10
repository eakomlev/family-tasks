export const getInitial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'

// стабильный оттенок из строки; насыщенность и яркость подобраны, чтобы белая буква читалась в обеих темах
export function getAvatarColor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `hsl(${hash % 360} 55% 42%)`
}
