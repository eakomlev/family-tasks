import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

// Результат обработки: сжатое видео (MP4, H.264 + AAC), кадр-превью (JPEG) и итоговые размеры.
export interface ProcessedVideo {
  video: Buffer
  thumb: Buffer
  width: number
  height: number
  // секунды, округлено
  duration: number
}

// Файл не видео, битый или слишком длинный: ошибка клиента (422), а не сбой сервиса.
export class InvalidVideo extends Error {
  constructor(readonly code: 'invalid_video' | 'video_too_long') {
    super(code)
    this.name = 'InvalidVideo'
  }
}

// Узкий интерфейс, чтобы в тестах подставлять замену (настоящий ffmpeg есть не везде).
export interface VideoProcessor {
  process(input: Buffer): Promise<ProcessedVideo>
}

export interface FfmpegOptions {
  maxSeconds: number
  ffmpeg?: string
  ffprobe?: string
  // предел на одну обработку (перекодирование долгого видео на слабом сервере)
  timeoutMs?: number
}

interface Probe {
  width: number
  height: number
  duration: number
}

// Размеры и длительность первого видеопотока; null, если видео в файле нет
async function probe(ffprobe: string, file: string, timeoutMs: number): Promise<Probe | null> {
  let stdout: string
  try {
    ;({ stdout } = await run(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file], { timeout: timeoutMs }))
  } catch {
    return null
  }
  try {
    const data = JSON.parse(stdout) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } }
    const stream = data.streams?.[0]
    const duration = Number(data.format?.duration)
    if (!stream?.width || !stream.height || !Number.isFinite(duration) || duration <= 0) return null
    return { width: stream.width, height: stream.height, duration }
  } catch {
    return null
  }
}

// Обработка настоящим ffmpeg: проверка, сжатие до 720p (длинная сторона до 1280), faststart (начинает играть до полной загрузки), превью.
// Обработки идут по одной: перекодирование занимает процессор, а сервис живёт рядом с остальными.
export function createFfmpegProcessor({ maxSeconds, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', timeoutMs = 4 * 60_000 }: FfmpegOptions): VideoProcessor {
  let queue: Promise<unknown> = Promise.resolve()

  async function work(input: Buffer): Promise<ProcessedVideo> {
    const dir = await mkdtemp(join(tmpdir(), 'video-'))
    try {
      const source = join(dir, 'in')
      const out = join(dir, 'out.mp4')
      const thumb = join(dir, 'thumb.jpg')
      await writeFile(source, input)

      const info = await probe(ffprobe, source, 30_000)
      if (!info) throw new InvalidVideo('invalid_video')
      // небольшой запас на погрешность контейнера
      if (info.duration > maxSeconds + 1) throw new InvalidVideo('video_too_long')

      try {
        await run(
          ffmpeg,
          [
            '-y', '-v', 'error', '-i', source,
            '-map', '0:v:0', '-map', '0:a:0?',
            '-vf', 'scale=w=min(1280\\,iw):h=min(1280\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '96k',
            '-movflags', '+faststart',
            out,
          ],
          { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
        )
      } catch {
        throw new InvalidVideo('invalid_video')
      }

      const result = await probe(ffprobe, out, 30_000)
      if (!result) throw new InvalidVideo('invalid_video')

      // кадр-превью: около секунды от начала (у совсем короткого видео середина)
      await run(
        ffmpeg,
        ['-y', '-v', 'error', '-ss', String(Math.min(1, result.duration / 2)), '-i', out, '-frames:v', '1', '-vf', 'scale=w=min(480\\,iw):h=-2', '-q:v', '4', thumb],
        { timeout: 60_000 },
      )
      return {
        video: await readFile(out),
        thumb: await readFile(thumb),
        width: result.width,
        height: result.height,
        duration: Math.max(1, Math.round(result.duration)),
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  return {
    process(input) {
      const next = queue.then(() => work(input))
      // сбой одной обработки не должен останавливать очередь
      queue = next.catch(() => {})
      return next
    },
  }
}
