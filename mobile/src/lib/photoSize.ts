// Предельные размеры фото для чата (как на сервере) и расчёт размера после уменьшения
export const PHOTO_MAX_SIDE = 1600
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024

// Размер после уменьшения: длинная сторона не больше предела, без увеличения маленьких фото
export function fitSize(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
