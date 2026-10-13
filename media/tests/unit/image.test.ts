import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { FULL_SIDE, InvalidImage, processImage, THUMB_SIDE } from '../../src/image.js'
import { makeJpeg } from '../jpeg.js'

describe('processImage', () => {
  it('большое фото уменьшается до 1600 px по длинной стороне, превью до 480, пропорции сохраняются', async () => {
    const out = await processImage(await makeJpeg(4000, 3000))
    expect([out.width, out.height]).toEqual([FULL_SIDE, 1200])
    expect(await sharp(out.full).metadata()).toMatchObject({ width: FULL_SIDE, height: 1200, format: 'jpeg' })
    expect(await sharp(out.thumb).metadata()).toMatchObject({ width: THUMB_SIDE, height: 360, format: 'jpeg' })
    expect(out.thumb.length).toBeLessThan(out.full.length)
  })

  it('маленькое фото не увеличивается', async () => {
    const out = await processImage(await makeJpeg(300, 200))
    expect([out.width, out.height]).toEqual([300, 200])
    expect((await sharp(out.thumb).metadata()).width).toBe(300)
  })

  it('ориентация из EXIF применяется к пикселям (портретный снимок телефона)', async () => {
    // 600x400 с меткой «повернуть на 90°» это на самом деле портрет 400x600
    const out = await processImage(await makeJpeg(600, 400, { orientation: 6 }))
    expect([out.width, out.height]).toEqual([400, 600])
  })

  it('EXIF, в том числе геопозиция, не сохраняется', async () => {
    const source = await makeJpeg(800, 600, { gps: true })
    expect((await sharp(source).metadata()).exif).toBeDefined()
    const out = await processImage(source)
    for (const buffer of [out.full, out.thumb]) {
      const meta = await sharp(buffer).metadata()
      expect(meta.exif).toBeUndefined()
      expect(buffer.includes(Buffer.from('GPS'))).toBe(false)
      expect(buffer.includes(Buffer.from('TestCam'))).toBe(false)
    }
  })

  it.each([
    ['PNG вместо JPEG', async () => sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer()],
    ['мусор', async () => Buffer.from('это не картинка вовсе')],
    ['пустой файл', async () => Buffer.alloc(0)],
    ['только сигнатура JPEG', async () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])],
  ])('отклоняется: %s', async (_name, make) => {
    await expect(processImage(await make())).rejects.toBeInstanceOf(InvalidImage)
  })

  it('обрезанный JPEG отклоняется, а не отдаётся наполовину', async () => {
    const source = await makeJpeg(1200, 900)
    await expect(processImage(source.subarray(0, Math.floor(source.length / 2)))).rejects.toBeInstanceOf(InvalidImage)
  })
})
