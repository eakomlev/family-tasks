// Подпись в адресе фото меняется раз в сутки, а файл неизменяем. Кэш картинок держим по адресу без подписи
// (/media/<семья>/<файл>/thumb или full), иначе после смены подписи все фото качались бы заново.
export function photoCacheKey(url: string): string | undefined {
  if (!/^https?:\/\//i.test(url)) return undefined
  const path = url.split(/[?#]/)[0]
  return /\/media\/[^/]+\/[^/]+\/(thumb|full)$/.test(path) ? path : undefined
}
