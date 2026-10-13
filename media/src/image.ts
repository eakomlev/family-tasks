import sharp from 'sharp'

// Длинная сторона полноразмерного варианта и превью, качество JPEG.
export const FULL_SIDE = 1600
export const THUMB_SIDE = 480
// Защита от «бомб»: огромные по размеру картинки не декодируем.
const MAX_PIXELS = 50_000_000

export interface Processed {
  full: Buffer
  thumb: Buffer
  width: number
  height: number
}

export class InvalidImage extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidImage'
  }
}

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff

// Принимает только JPEG (клиент всегда перекодирует фото в него). Перекодируем сами: так пропадают EXIF с геопозицией и
// любые подложенные данные, а ориентация применяется к пикселям. Размер результата это размер полноразмерного варианта.
export async function processImage(input: Buffer): Promise<Processed> {
  if (!isJpeg(input)) throw new InvalidImage('not a jpeg')
  try {
    const base = () => sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate()
    const full = await base().resize({ width: FULL_SIDE, height: FULL_SIDE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, progressive: true }).toBuffer({ resolveWithObject: true })
    const thumb = await base().resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()
    return { full: full.data, thumb, width: full.info.width, height: full.info.height }
  } catch (err) {
    throw new InvalidImage((err as Error).message)
  }
}
