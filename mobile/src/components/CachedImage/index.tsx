import { Image, type ImageProps } from 'expo-image'
import { photoCacheKey } from '@/lib/photoCache'

// Картинка из сети с дисковым кэшем (expo-image): фото чата не скачивается заново при каждом открытии экрана.
// Ключ кэша без подписи ссылки (см. lib/photoCache), локальные адреса (ещё не отправленное фото) идут как есть.
export function CachedImage({ uri, ...rest }: { uri: string } & Omit<ImageProps, 'source'>) {
  return <Image source={{ uri, cacheKey: photoCacheKey(uri) }} cachePolicy="disk" transition={120} {...rest} />
}
