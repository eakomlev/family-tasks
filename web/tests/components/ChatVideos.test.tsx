import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ChatMessage, type ChatSummary, type ChatVideo } from '@/api'
import { describeVideoError } from '@/lib/errors'
import { formatDuration, isVideoFile, MAX_VIDEO_BYTES, videoContentType, videoProblem } from '@/lib/video'
import { chatPreviewParts } from '@/pages/Chat/utils'
import { Composer } from '@/pages/ChatRoom/components/Composer'
import { MessageBubble } from '@/pages/ChatRoom/components/MessageBubble'
import { VideoViewer } from '@/pages/ChatRoom/components/VideoViewer'
import { bubbleText } from '@/pages/ChatRoom/utils'

// длительность читает настоящий браузер из метаданных; в jsdom её подменяем
const duration = vi.hoisted(() => vi.fn())
vi.mock('@/lib/video', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/video')>()), readVideoDuration: duration }))

const clip = (name = 'ролик.mp4', size = 2000, type = 'video/mp4') => new File([new Uint8Array(size)], name, { type })
const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('Выбрать фото или файл'), { target: { files } })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  duration.mockReset().mockResolvedValue(12)
})
afterEach(cleanup)

describe('lib/video', () => {
  it('видео определяется по типу, а без типа по расширению', () => {
    expect(isVideoFile({ name: 'a.mp4', type: 'video/mp4' })).toBe(true)
    expect(isVideoFile({ name: 'IMG_1.MOV', type: '' })).toBe(true)
    expect(isVideoFile({ name: 'a.pdf', type: 'application/pdf' })).toBe(false)
    expect(isVideoFile({ name: 'a.mov', type: 'application/octet-stream' })).toBe(false)
    expect(videoContentType({ name: 'IMG_1.MOV', type: '' })).toBe('video/quicktime')
    expect(videoContentType({ name: 'x', type: 'video/webm' })).toBe('video/webm')
  })

  it('длительность словами, пределы размера и времени', () => {
    expect(formatDuration(7)).toBe('0:07')
    expect(formatDuration(125)).toBe('2:05')
    expect(videoProblem({ size: 0 }, 5)).toBe('Видео пустое.')
    expect(videoProblem({ size: MAX_VIDEO_BYTES + 1 }, 5)).toMatch(/больше 100 МБ/)
    expect(videoProblem({ size: 10 }, 181)).toMatch(/длиннее 3 минут/)
    expect(videoProblem({ size: 10 }, 180)).toBeNull()
    // длительность узнать не удалось: решает сервер
    expect(videoProblem({ size: 10 }, null)).toBeNull()
  })

  it('тексты ошибок загрузки', () => {
    expect(describeVideoError(new ApiError(400, 'video_too_long'))).toMatch(/3 минут/)
    expect(describeVideoError(new ApiError(400, 'invalid_video'))).toMatch(/Не удалось прочитать/)
    expect(describeVideoError(new ApiError(413, 'media_quota'))).toMatch(/Место для видео/)
    expect(describeVideoError(new Error('x'))).toMatch(/Не удалось загрузить видео/)
  })
})

describe('Composer: видео', () => {
  it('видео загружается, показывается в списке и уходит в videoIds; без текста отправить можно', async () => {
    const onUploadVideo = vi.fn().mockResolvedValue('video-1')
    const onSend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Composer onSend={onSend} onUpload={vi.fn()} onUploadFile={vi.fn()} onUploadVideo={onUploadVideo} />)
    const file = clip()
    pick([file])
    const list = await screen.findByLabelText('Выбранные видео')
    expect(within(list).getByText(/ролик\.mp4/)).toBeInTheDocument()
    await waitFor(() => expect(onUploadVideo).toHaveBeenCalledWith(file))
    // пока сервер сжимает видео, отправить нельзя
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledWith({ text: '', mediaIds: [], fileIds: [], videoIds: ['video-1'] })
    await waitFor(() => expect(screen.queryByLabelText('Выбранные видео')).toBeNull())
  })

  it('пока видео обрабатывается, «Отправить» заблокирована и написано, что идёт обработка', async () => {
    let finish: (id: string) => void = () => {}
    const onUploadVideo = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)))
    render(<Composer onSend={vi.fn()} onUpload={vi.fn()} onUploadFile={vi.fn()} onUploadVideo={onUploadVideo} />)
    pick([clip()])
    expect(await screen.findByText('Загружается и обрабатывается…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    finish('v1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
  })

  it('слишком длинное и слишком большое отклоняются на устройстве, без загрузки и без повтора', async () => {
    const onUploadVideo = vi.fn().mockResolvedValue('x')
    render(<Composer onSend={vi.fn()} onUpload={vi.fn()} onUploadFile={vi.fn()} onUploadVideo={onUploadVideo} />)
    duration.mockResolvedValue(400)
    pick([clip('длинное.mp4')])
    expect(await screen.findByText(/длиннее 3 минут/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Убрать видео длинное.mp4/ }))
    pick([clip('огромное.mp4', MAX_VIDEO_BYTES + 1)])
    expect(await screen.findByText(/больше 100 МБ/)).toBeInTheDocument()
    expect(onUploadVideo).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Повторить загрузку видео/ })).toBeNull()
  })

  it('ошибка загрузки показана, «Ещё раз» повторяет, убрать можно', async () => {
    const onUploadVideo = vi.fn().mockRejectedValueOnce(new ApiError(400, 'invalid_video')).mockResolvedValue('v2')
    const user = userEvent.setup()
    render(<Composer onSend={vi.fn()} onUpload={vi.fn()} onUploadFile={vi.fn()} onUploadVideo={onUploadVideo} />)
    pick([clip()])
    expect(await screen.findByText(/Не удалось прочитать это видео/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Повторить загрузку видео ролик\.mp4/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    expect(onUploadVideo).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: /Убрать видео ролик\.mp4/ }))
    expect(screen.queryByLabelText('Выбранные видео')).toBeNull()
  })

  it('больше трёх видео не берётся, с предупреждением', async () => {
    const onUploadVideo = vi.fn().mockResolvedValue('v')
    render(<Composer onSend={vi.fn()} onUpload={vi.fn()} onUploadFile={vi.fn()} onUploadVideo={onUploadVideo} />)
    pick([clip('1.mp4'), clip('2.mp4'), clip('3.mp4'), clip('4.mp4')])
    expect(await screen.findByText(/не больше 3 видео/)).toBeInTheDocument()
    await waitFor(() => expect(onUploadVideo).toHaveBeenCalledTimes(3))
  })

  it('без поддержки на странице видео отклоняется, ничего не загружается', async () => {
    const onUploadFile = vi.fn()
    render(<Composer onSend={vi.fn()} onUpload={vi.fn()} onUploadFile={onUploadFile} />)
    pick([clip()])
    await waitFor(() => expect(screen.queryByLabelText('Выбранные видео')).toBeNull())
    expect(onUploadFile).not.toHaveBeenCalled()
  })

  it('видео .mov без типа тоже считается видео', async () => {
    const onUploadVideo = vi.fn().mockResolvedValue('v')
    render(<Composer onSend={vi.fn()} onUpload={vi.fn()} onUploadFile={vi.fn()} onUploadVideo={onUploadVideo} />)
    pick([clip('IMG_0001.MOV', 100, '')])
    await waitFor(() => expect(onUploadVideo).toHaveBeenCalledTimes(1))
  })
})

const video = (patch: Partial<ChatVideo> = {}): ChatVideo => ({ id: 'v1', width: 720, height: 1280, duration: 75, thumbUrl: '/media/f/v1/thumb?exp=1&sig=a', url: '/media/f/v1/video?exp=1&sig=a', ...patch })
const message = (patch: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  senderId: 'kid',
  text: '🎬 Видео',
  caption: '',
  createdAt: '2026-10-25T10:00:00Z',
  media: [],
  files: [],
  videos: [video()],
  reactions: [],
  awards: [],
  ...patch,
})

describe('MessageBubble: видео', () => {
  it('кадр-превью с длительностью; заглушки «🎬 Видео» в пузыре нет, подпись есть', () => {
    render(<MessageBubble message={message({ caption: 'смотрите', text: 'смотрите' })} mine={false} showSender={false} />)
    expect(screen.getByRole('button', { name: 'Смотреть видео, 1:15' })).toBeInTheDocument()
    expect(screen.getByText('смотрите')).toBeInTheDocument()
    expect(screen.queryByText('🎬 Видео')).toBeNull()
    expect(bubbleText(message())).toBe('')
  })

  it('нажатие открывает видео с этим номером', async () => {
    const onOpenVideo = vi.fn()
    render(<MessageBubble message={message({ videos: [video(), video({ id: 'v2', duration: 9 })] })} mine={false} showSender={false} onOpenVideo={onOpenVideo} />)
    await userEvent.click(screen.getByRole('button', { name: 'Смотреть видео, 0:09' }))
    expect(onOpenVideo).toHaveBeenCalledWith(1)
  })
})

describe('VideoViewer', () => {
  it('плеер с адресом видео и превью; закрывается крестиком и Escape', async () => {
    const onClose = vi.fn()
    render(<VideoViewer video={video()} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Просмотр видео' })
    const player = dialog.querySelector('video')!
    expect(player).toHaveAttribute('src', '/media/f/v1/video?exp=1&sig=a')
    expect(player).toHaveAttribute('poster', '/media/f/v1/thumb?exp=1&sig=a')
    expect(player.hasAttribute('controls')).toBe(true)
    // нажатие на сам плеер не закрывает
    fireEvent.click(player)
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('список чатов: превью', () => {
  const chat = (last: Partial<ChatMessage>): ChatSummary => ({ id: 'family', last: message(last), unread: 0, muted: false, readUpTo: null }) as ChatSummary
  it('«🎬 Видео», «🎬 3 видео» и «🎬 подпись»', () => {
    expect(chatPreviewParts(chat({}), 'me', [], 'mama').text).toBe('🎬 Видео')
    expect(chatPreviewParts(chat({ videos: [video(), video({ id: 'a' }), video({ id: 'b' })] }), 'me', [], 'mama').text).toBe('🎬 3 видео')
    expect(chatPreviewParts(chat({ caption: 'вот' }), 'me', [], 'mama').text).toBe('🎬 вот')
  })
})
