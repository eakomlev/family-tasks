import sharp from 'sharp'

// Тестовая фотография: градиент нужного размера. orientation 6 это «повернуть на 90°» (так снимает телефон в портрете).
export async function makeJpeg(width: number, height: number, opts: { orientation?: number; gps?: boolean } = {}): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3
    raw[i] = (x * 255) / width
    raw[i + 1] = (y * 255) / height
    raw[i + 2] = 128
  }
  let img = sharp(raw, { raw: { width, height, channels: 3 } })
  const exif: Record<string, Record<string, string>> = { IFD0: { Make: 'TestCam' } }
  if (opts.gps) exif.IFD3 = { GPSLatitudeRef: 'N', GPSLatitude: '55/1 45/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '37/1 37/1 0/1' }
  img = img.withExif(exif)
  let out = await img.jpeg({ quality: 90 }).toBuffer()
  if (opts.orientation) out = await sharp(out).withMetadata({ orientation: opts.orientation }).jpeg().toBuffer()
  return out
}
