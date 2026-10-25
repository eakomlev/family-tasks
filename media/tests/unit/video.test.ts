import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, describe, expect, it } from 'vitest'
import { createFfmpegProcessor, InvalidVideo } from '../../src/video.js'

// Настоящий ffmpeg есть не везде (на Windows разработчика обычно нет, в CI и в контейнере ставится): без него проверка пропускается.
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

const dir = mkdtempSync(join(tmpdir(), 'video-test-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

// Короткий проверочный ролик без внешних файлов: тестовая картинка и тон; возвращает путь к файлу
function makeVideo(seconds: number, size = '640x360'): string {
  const file = join(dir, `src-${seconds}-${size}.mp4`)
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc=duration=${seconds}:size=${size}:rate=15`, '-f', 'lavfi', '-i', `sine=duration=${seconds}`, '-shortest', '-pix_fmt', 'yuv420p', file])
  return file
}

// Файл с произвольным содержимым (не видео)
function junk(): string {
  const file = join(dir, `junk-${Math.random().toString(36).slice(2)}`)
  writeFileSync(file, 'это не видео')
  return file
}

describe.skipIf(!hasFfmpeg)('ffmpeg: сжатие видео', () => {
  const processor = createFfmpegProcessor({ maxSeconds: 5 })

  it('сжимает до 720p, оставляет пропорции, делает превью-кадр', async () => {
    const result = await processor.process(makeVideo(2, '1920x1080'))
    expect(result.width).toBe(1280)
    expect(result.height).toBe(720)
    expect(result.duration).toBe(2)
    // MP4: в начале файла (после размера) метка «ftyp»; результат лежит файлом, размер совпадает с заявленным
    const bytes = readFileSync(result.videoPath)
    expect(bytes.subarray(4, 8).toString()).toBe('ftyp')
    expect(bytes.length).toBe(result.size)
    const thumb = await sharp(result.thumb).metadata()
    expect(thumb.format).toBe('jpeg')
    expect(thumb.width).toBeLessThanOrEqual(480)
    await result.cleanup()
    expect(existsSync(result.videoPath)).toBe(false)
  })

  it('маленькое видео не увеличивается', async () => {
    const result = await processor.process(makeVideo(1, '320x240'))
    expect(result).toMatchObject({ width: 320, height: 240 })
  })

  it('не видео: InvalidVideo', async () => {
    await expect(processor.process(junk())).rejects.toMatchObject({ code: 'invalid_video' })
    await expect(processor.process(junk())).rejects.toBeInstanceOf(InvalidVideo)
  })

  it('длиннее предела: video_too_long', async () => {
    await expect(processor.process(makeVideo(7))).rejects.toMatchObject({ code: 'video_too_long' })
  })

  it('обработки идут по одной и сбой не ломает очередь', async () => {
    const results = await Promise.allSettled([processor.process(junk()), processor.process(makeVideo(1))])
    expect(results[0].status).toBe('rejected')
    expect(results[1].status).toBe('fulfilled')
  })
})
