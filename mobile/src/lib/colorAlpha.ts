// Цвет с прозрачностью: '#161a33' и 0.6 дают 'rgba(22, 26, 51, 0.6)'. Нужен для «стеклянных» панелей чата и градиентов затемнения:
// в градиенте нужен тот же цвет с нулевой прозрачностью, а не слово transparent (на iPhone оно даёт серую кайму).
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
