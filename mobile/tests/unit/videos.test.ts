import { describe, expect, it } from 'vitest'
import { absolutizeMessage, ApiError, type ChatMessage, type ChatSummary, type ChatVideo } from '@/api'
import { chatPreviewParts } from '@/features/chat/listUtils'
import { getPending, pendingToMessage, resetPending, startSend } from '@/features/chat/pending'
import { bubbleText } from '@/features/chat/roomUtils'
import { describeVideoError } from '@/lib/errors'
import { formatDuration, MAX_VIDEO_BYTES, videoMimeType, videoProblem } from '@/lib/video'

const video = (patch: Partial<ChatVideo> = {}): ChatVideo => ({ id: 'v1', width: 720, height: 1280, duration: 75, thumbUrl: '/media/f/v1/thumb?exp=1&sig=a', url: '/media/f/v1/video?exp=1&sig=a', ...patch })
const message = (patch: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  senderId: 'kid',
  text: '🎬 Видео',
  caption: '',
  media: [],
  files: [],
  videos: [video()],
  createdAt: '2026-10-25T10:00:00Z',
  reactions: [],
  awards: [],
  ...patch,
})

describe('lib/video', () => {
  it('длительность словами', () => {
    expect(formatDuration(7)).toBe('0:07')
    expect(formatDuration(125)).toBe('2:05')
  })

  it('пределы размера и времени (длительность из выбора в миллисекундах)', () => {
    expect(videoProblem({ size: 0 })).toBe('Видео пустое.')
    expect(videoProblem({ size: MAX_VIDEO_BYTES + 1 })).toMatch(/больше 100 МБ/)
    expect(videoProblem({ size: 10, durationMs: 181_000 })).toMatch(/длиннее 3 минут/)
    expect(videoProblem({ size: 10, durationMs: 180_000 })).toBeNull()
    // длительность неизвестна: решает сервер
    expect(videoProblem({ size: 10, durationMs: null })).toBeNull()
    expect(videoProblem({ size: 10 })).toBeNull()
  })

  it('тип для загрузки: из выбора, иначе по расширению', () => {
    expect(videoMimeType('a.mp4', 'video/webm')).toBe('video/webm')
    expect(videoMimeType('IMG_1.MOV', null)).toBe('video/quicktime')
    expect(videoMimeType('clip', undefined)).toBe('video/mp4')
    expect(videoMimeType('a.mov', 'application/octet-stream')).toBe('video/quicktime')
  })

  it('тексты ошибок загрузки', () => {
    expect(describeVideoError(new ApiError(400, 'video_too_long'))).toMatch(/3 минут/)
    expect(describeVideoError(new ApiError(400, 'invalid_video'))).toMatch(/Не удалось прочитать/)
    expect(describeVideoError(new ApiError(400, 'video_failed'))).toMatch(/более короткое/)
    expect(describeVideoError(new ApiError(503, 'media_busy'))).toMatch(/через минуту/)
    expect(describeVideoError(new ApiError(413, 'media_quota'))).toMatch(/Место для видео/)
    expect(describeVideoError(new Error('x'))).toMatch(/Не удалось загрузить видео/)
  })
})

describe('сообщение с видео', () => {
  it('адреса видео и превью становятся абсолютными', () => {
    const abs = absolutizeMessage(message())
    expect(abs.videos![0].url).toBe('https://family.test/media/f/v1/video?exp=1&sig=a')
    expect(abs.videos![0].thumbUrl).toBe('https://family.test/media/f/v1/thumb?exp=1&sig=a')
  })

  it('сообщение без видео (сервер прежней версии) остаётся без поля', () => {
    expect(absolutizeMessage(message({ videos: undefined })).videos).toBeUndefined()
  })

  it('в пузыре подпись, а не заглушка «🎬 Видео»', () => {
    expect(bubbleText(message())).toBe('')
    expect(bubbleText(message({ caption: 'смотрите' }))).toBe('смотрите')
    expect(bubbleText(message({ videos: [], text: 'обычный текст' }))).toBe('обычный текст')
  })

  it('превью в списке чатов: «🎬 Видео», «🎬 3 видео», «🎬 подпись»', () => {
    const chat = (last: Partial<ChatMessage>): ChatSummary => ({ id: 'family', last: message(last), unread: 0, muted: false, readUpTo: null }) as ChatSummary
    expect(chatPreviewParts(chat({}), 'me', [], 'mama').text).toBe('🎬 Видео')
    expect(chatPreviewParts(chat({ videos: [video(), video({ id: 'a' }), video({ id: 'b' })] }), 'me', [], 'mama').text).toBe('🎬 3 видео')
    expect(chatPreviewParts(chat({ caption: 'вот' }), 'me', [], 'mama').text).toBe('🎬 вот')
  })

  it('пока отправляется, в ленте стоит плитка видео с длительностью', () => {
    resetPending()
    startSend({ chat: 'family', text: '', mediaIds: [], fileIds: [], videoIds: ['v1'], photoUris: [], files: [], videos: [{ duration: 12 }] }, () => new Promise(() => {}))
    const shown = pendingToMessage(getPending()[0], 'me')
    expect(shown.videos).toHaveLength(1)
    expect(shown.videos![0]).toMatchObject({ duration: 12, thumbUrl: '', url: '' })
    resetPending()
  })
})
