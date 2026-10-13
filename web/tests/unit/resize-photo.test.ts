import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageError, PHOTO_MAX_BYTES, resizeToPhoto } from '@/lib/image'

// jsdom не умеет рисовать: подменяем ImageBitmap и холст, проверяем расчёт размеров и повтор с меньшим качеством
const drawn: { w: number; h: number }[] = []
let qualities: number[] = []
let sizes: number[] = []

function stubCanvas(blobSizes: number[]) {
  sizes = [...blobSizes]
  qualities = []
  drawn.length = 0
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { imageSmoothingQuality: '', drawImage: (_b: unknown, _x: number, _y: number, w: number, h: number) => drawn.push({ w, h }) } as unknown as CanvasRenderingContext2D
  } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, _type, quality) => {
    qualities.push(quality as number)
    const size = sizes.shift() ?? 1000
    cb(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }))
  })
}

const bitmap = (width: number, height: number) => ({ width, height, close: vi.fn() }) as unknown as ImageBitmap
const file = (type = 'image/jpeg', size = 1000) => new File([new Uint8Array(size)], 'a.jpg', { type })

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap(4000, 3000)))
})
afterEach(() => vi.unstubAllGlobals())

describe('resizeToPhoto', () => {
  it('большое фото уменьшается до 1600 по длинной стороне с сохранением пропорций', async () => {
    stubCanvas([200_000])
    const out = await resizeToPhoto(file())
    expect([out.width, out.height]).toEqual([1600, 1200])
    expect(drawn[0]).toEqual({ w: 1600, h: 1200 })
    expect(out.blob.type).toBe('image/jpeg')
    expect(qualities).toEqual([0.82])
  })

  it('портретное фото: длинная сторона высота', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap(3000, 4000)))
    stubCanvas([1000])
    const out = await resizeToPhoto(file())
    expect([out.width, out.height]).toEqual([1200, 1600])
  })

  it('маленькое фото не увеличивается', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap(800, 600)))
    stubCanvas([1000])
    const out = await resizeToPhoto(file())
    expect([out.width, out.height]).toEqual([800, 600])
  })

  it('запрашивает поворот из метаданных камеры', async () => {
    stubCanvas([1000])
    await resizeToPhoto(file())
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' })
  })

  it('слишком тяжёлый результат пересжимается с меньшим качеством', async () => {
    stubCanvas([PHOTO_MAX_BYTES + 1, PHOTO_MAX_BYTES + 1, 500_000])
    const out = await resizeToPhoto(file())
    expect(out.blob.size).toBe(500_000)
    expect(qualities).toHaveLength(3)
    expect(qualities[1]).toBeLessThan(qualities[0])
    expect(qualities[2]).toBeLessThan(qualities[1])
  })

  it('не помещается даже при минимальном качестве: too_large', async () => {
    stubCanvas(Array.from({ length: 10 }, () => PHOTO_MAX_BYTES + 1))
    await expect(resizeToPhoto(file())).rejects.toMatchObject({ reason: 'too_large' })
  })

  it('не изображение, слишком большой исходник, нечитаемый файл', async () => {
    stubCanvas([])
    await expect(resizeToPhoto(file('text/plain'))).rejects.toMatchObject({ reason: 'not_image' })
    await expect(resizeToPhoto(file('image/jpeg', 31 * 1024 * 1024))).rejects.toMatchObject({ reason: 'too_large' })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('bad') }))
    await expect(resizeToPhoto(file())).rejects.toBeInstanceOf(ImageError)
    await expect(resizeToPhoto(file())).rejects.toMatchObject({ reason: 'decode_failed' })
  })

  it('освобождает изображение после обработки', async () => {
    const b = bitmap(4000, 3000)
    vi.stubGlobal('createImageBitmap', vi.fn(async () => b))
    stubCanvas([1000])
    await resizeToPhoto(file())
    expect(b.close).toHaveBeenCalled()
  })
})
