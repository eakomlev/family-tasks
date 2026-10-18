import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { ImageError } from './imageError'

export { ImageError } from './imageError'

// Выбор картинки из галереи с обрезкой до квадрата и сжатием до size × size JPEG (data URL). Фото аватара около 5–10 КБ,
// чтобы его можно было хранить прямо в таблице участников; сервер ничего не ресайзит. null, если человек отменил выбор.
export async function pickSquareImage(size: number, quality = 0.8): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) throw new ImageError('no_permission')

  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 })
  if (picked.canceled || !picked.assets[0]) return null

  try {
    const result = await ImageManipulator.manipulateAsync(picked.assets[0].uri, [{ resize: { width: size, height: size } }], {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    })
    if (!result.base64) throw new ImageError('decode_failed')
    return `data:image/jpeg;base64,${result.base64}`
  } catch (err) {
    throw err instanceof ImageError ? err : new ImageError('decode_failed')
  }
}
