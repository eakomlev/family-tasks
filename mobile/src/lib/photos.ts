import * as ImageManipulator from 'expo-image-manipulator'
import { ImageError } from './image'
import { fitSize, PHOTO_MAX_BYTES } from './photoSize'

// Подготовка фото для чата на устройстве: длинная сторона до 1600 px, JPEG качеством 0,82; метка геопозиции пропадает, поворот
// камеры применяется к пикселям. Если файл больше предела сервера, качество снижается.
const QUALITIES = [0.82, 0.7, 0.55, 0.4]

export interface PreparedPhoto {
  uri: string
  blob: Blob
  width: number
  height: number
}

export async function preparePhoto(uri: string, width: number, height: number): Promise<PreparedPhoto> {
  const size = fitSize(width, height)
  try {
    for (const quality of QUALITIES) {
      const result = await ImageManipulator.manipulateAsync(uri, [{ resize: size }], { compress: quality, format: ImageManipulator.SaveFormat.JPEG })
      const blob = await (await fetch(result.uri)).blob()
      if (blob.size <= PHOTO_MAX_BYTES || quality === QUALITIES[QUALITIES.length - 1]) {
        if (blob.size > PHOTO_MAX_BYTES) throw new ImageError('too_large')
        return { uri: result.uri, blob, width: result.width, height: result.height }
      }
    }
  } catch (err) {
    throw err instanceof ImageError ? err : new ImageError('decode_failed')
  }
  throw new ImageError('decode_failed')
}
