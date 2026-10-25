import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ChatMessage, type ChatSummary } from '@/api'
import { formatFileSize, fileProblem, isBlockedFileName } from '@/lib/files'
import { Composer } from '@/pages/ChatRoom/components/Composer'
import { MessageBubble } from '@/pages/ChatRoom/components/MessageBubble'
import { chatPreviewParts } from '@/pages/Chat/utils'

const resize = vi.hoisted(() => vi.fn())
vi.mock('@/lib/image', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/image')>()), resizeToPhoto: resize }))

const doc = (name = 'Отчёт.pdf', size = 20, type = 'application/pdf') => new File([new Uint8Array(size)], name, { type })
const jpeg = (name = 'a.jpg') => new File([new Uint8Array(10)], name, { type: 'image/jpeg' })
const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('Выбрать фото или файл'), { target: { files } })

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  resize.mockReset().mockImplementation(async () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }), width: 800, height: 600 }))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Composer: файлы', () => {
  it('не картинка загружается как файл (без уменьшения), показывается в списке, уходит в fileIds', async () => {
    const onUploadFile = vi.fn().mockResolvedValue('file-1')
    const onUpload = vi.fn()
    const onSend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Composer onSend={onSend} onUploadFile={onUploadFile} onUpload={onUpload} />)
    const file = doc()
    pick([file])
    const list = await screen.findByLabelText('Выбранные файлы')
    expect(within(list).getByText('Отчёт.pdf')).toBeInTheDocument()
    await waitFor(() => expect(onUploadFile).toHaveBeenCalledWith(file))
    expect(await within(list).findByText('20 Б')).toBeInTheDocument()
    expect(resize).not.toHaveBeenCalled()
    expect(onUpload).not.toHaveBeenCalled()
    // файл без текста отправить можно
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledWith({ text: '', mediaIds: [], fileIds: ['file-1'], videoIds: [] })
    await waitFor(() => expect(screen.queryByLabelText('Выбранные файлы')).toBeNull())
  })

  it('фото и файл в одном сообщении: каждый своим путём', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Composer onSend={onSend} onUploadFile={vi.fn().mockResolvedValue('f1')} onUpload={vi.fn().mockResolvedValue('p1')} />)
    pick([jpeg('a.jpg'), doc('b.docx')])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    await user.type(screen.getByLabelText('Подпись к фото'), 'вот')
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledWith({ text: 'вот', mediaIds: ['p1'], fileIds: ['f1'], videoIds: [] })
  })

  it('слишком большой и запрещённый файлы отклоняются сразу, без загрузки; повтора нет', async () => {
    const onUploadFile = vi.fn().mockResolvedValue('x')
    render(<Composer onSend={vi.fn()} onUploadFile={onUploadFile} onUpload={vi.fn()} />)
    pick([doc('big.zip', 50 * 1024 * 1024 + 1), doc('setup.exe', 5, 'application/x-msdownload')])
    const list = await screen.findByLabelText('Выбранные файлы')
    expect(within(list).getAllByText('Не загружен')).toHaveLength(2)
    expect(screen.getAllByText(/Файл больше 50 МБ|Такие файлы отправлять нельзя/).length).toBeGreaterThan(0)
    expect(onUploadFile).not.toHaveBeenCalled()
    expect(within(list).queryByRole('button', { name: /Повторить/ })).toBeNull()
    // с неудавшимся файлом отправить нельзя, пока его не уберут
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Убрать файл big.zip' }))
    await userEvent.click(screen.getByRole('button', { name: 'Убрать файл setup.exe' }))
    expect(screen.queryByLabelText('Выбранные файлы')).toBeNull()
  })

  it('ошибка сервера: причина показана, «Ещё раз» повторяет без повторного выбора', async () => {
    const onUploadFile = vi.fn().mockRejectedValueOnce(new ApiError(502, 'media_unavailable')).mockResolvedValue('f2')
    const user = userEvent.setup()
    render(<Composer onSend={vi.fn()} onUploadFile={onUploadFile} onUpload={vi.fn()} />)
    pick([doc()])
    expect(await screen.findByText(/Сервис файлов сейчас недоступен/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторить загрузку файла Отчёт.pdf' }))
    await waitFor(() => expect(onUploadFile).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
  })

  it('больше пяти файлов не берётся, сказано почему', async () => {
    const onUploadFile = vi.fn().mockResolvedValue('f')
    render(<Composer onSend={vi.fn()} onUploadFile={onUploadFile} onUpload={vi.fn()} />)
    pick(Array.from({ length: 7 }, (_, i) => doc(`${i}.pdf`)))
    expect(await screen.findByText(/не больше 5 файлов/)).toBeInTheDocument()
    await waitFor(() => expect(onUploadFile).toHaveBeenCalledTimes(5))
  })
})

const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  senderId: 'kid',
  text: '📎 Отчёт.pdf',
  caption: '',
  media: [],
  files: [{ id: 'f1', name: 'Отчёт.pdf', size: 2_500_000, url: '/media/f/f1/file?exp=1&sig=a&name=x' }],
  createdAt: '2026-10-11T10:00:00Z',
  reactions: [],
  awards: [],
  ...over,
})

describe('MessageBubble: файлы', () => {
  it('показывает имя и размер; заглушку «📎 имя» не дублирует', () => {
    render(<MessageBubble message={message()} mine={false} showSender={false} />)
    const button = screen.getByRole('button', { name: 'Скачать файл Отчёт.pdf' })
    expect(button).toHaveTextContent('Отчёт.pdf')
    expect(button).toHaveTextContent('2,4 МБ')
    expect(screen.queryByText('📎 Отчёт.pdf')).toBeNull()
  })

  it('подпись к файлу показывается', () => {
    render(<MessageBubble message={message({ text: 'вот', caption: 'вот' })} mine showSender={false} />)
    expect(screen.getByText('вот')).toBeInTheDocument()
  })

  it('нажатие скачивает файл без ухода со страницы (из памяти через ссылку download)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['pdf']) })
    vi.stubGlobal('fetch', fetchMock)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      render(<MessageBubble message={message()} mine={false} showSender={false} />)
      await userEvent.click(screen.getByRole('button', { name: 'Скачать файл Отчёт.pdf' }))
      // ответ подменён простым объектом: Response из Node не дружит с Blob из jsdom (на разных версиях Node по-разному)
      await waitFor(() => expect(click).toHaveBeenCalled(), { timeout: 3000 })
      expect(fetchMock).toHaveBeenCalledWith('/media/f/f1/file?exp=1&sig=a&name=x')
    } finally {
      click.mockRestore()
    }
  })

  it('не получилось скачать: сообщение под файлом', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    render(<MessageBubble message={message()} mine={false} showSender={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Скачать файл Отчёт.pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить файл.')
  })
})

describe('список чатов и вспомогательные функции', () => {
  const summary = (last: ChatMessage): ChatSummary => ({ id: 'family', last, unread: 0 })

  it('превью: имя файла, число файлов или подпись со значком скрепки', () => {
    expect(chatPreviewParts(summary(message()), 'me', [], 'mama').text).toBe('📎 Отчёт.pdf')
    const three = message({ files: [1, 2, 3].map((n) => ({ id: `f${n}`, name: `${n}.pdf`, size: 1, url: '' })) })
    expect(chatPreviewParts(summary(three), 'me', [], 'mama').text).toBe('📎 3 файла')
    expect(chatPreviewParts(summary(message({ text: 'вот', caption: 'вот' })), 'me', [], 'mama').text).toBe('📎 вот')
  })

  it('размер человекочитаемый', () => {
    expect(formatFileSize(532)).toBe('532 Б')
    expect(formatFileSize(48 * 1024)).toBe('48 КБ')
    expect(formatFileSize(3.2 * 1024 * 1024)).toBe('3,2 МБ')
    expect(formatFileSize(25 * 1024 * 1024)).toBe('25 МБ')
  })

  it('проверка файла на устройстве повторяет правила сервера', () => {
    expect(fileProblem({ name: 'a.pdf', size: 100 })).toBeNull()
    expect(fileProblem({ name: 'a.pdf', size: 0 })).toMatch(/пустой/)
    expect(fileProblem({ name: 'a.pdf', size: 51 * 1024 * 1024 })).toMatch(/50 МБ/)
    expect(fileProblem({ name: 'a.EXE', size: 5 })).toMatch(/нельзя/)
    expect(isBlockedFileName('x.pdf.exe')).toBe(true)
    expect(isBlockedFileName('x.exe.pdf')).toBe(false)
  })
})
