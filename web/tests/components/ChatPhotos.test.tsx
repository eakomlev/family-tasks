import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ChatMedia, type ChatMessage } from '@/api'
import { ImageError } from '@/lib/image'
import { Composer } from '@/pages/ChatRoom/components/Composer'
import { MessageBubble } from '@/pages/ChatRoom/components/MessageBubble'
import { PhotoViewer } from '@/pages/ChatRoom/components/PhotoViewer'

const resize = vi.hoisted(() => vi.fn())
vi.mock('@/lib/image', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/image')>()), resizeToPhoto: resize }))

const media = (id: string, width = 800, height = 600): ChatMedia => ({
  id, width, height, thumbUrl: `/media/f/${id}/thumb?exp=1&sig=a`, fullUrl: `/media/f/${id}/full?exp=1&sig=a`,
})
const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1', senderId: 'kid', text: 'привет', caption: 'привет', media: [], createdAt: '2026-10-11T10:00:00Z', reactions: [], awards: [], ...over,
})
const jpeg = (name = 'a.jpg') => new File([new Uint8Array(10)], name, { type: 'image/jpeg' })

let counter = 0
beforeEach(() => {
  counter = 0
  URL.createObjectURL = vi.fn(() => `blob:preview-${++counter}`)
  URL.revokeObjectURL = vi.fn()
  resize.mockReset().mockImplementation(async () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }), width: 800, height: 600 }))
})

const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('Выбрать фото'), { target: { files } })

describe('Composer: фото', () => {
  it('выбранное фото уменьшается, загружается и показывается превью; отправка вместе с подписью', async () => {
    const onUpload = vi.fn().mockResolvedValue('media-1')
    const onSend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Composer onSend={onSend} onUpload={onUpload} />)
    pick([jpeg()])
    expect(await screen.findByAltText('Фото 1')).toHaveAttribute('src', 'blob:preview-1')
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
    expect(onUpload.mock.calls[0][0]).toBeInstanceOf(Blob)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())

    await user.type(screen.getByLabelText('Подпись к фото'), 'Смотри')
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledWith({ text: 'Смотри', mediaIds: ['media-1'] })
    // после отправки поле и вложения очищены, превью освобождено
    await waitFor(() => expect(screen.queryByAltText('Фото 1')).toBeNull())
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
    expect(screen.getByLabelText('Сообщение')).toHaveValue('')
  })

  it('одно только фото без текста отправить можно', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} onUpload={vi.fn().mockResolvedValue('m1')} />)
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    pick([jpeg()])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledWith({ text: '', mediaIds: ['m1'] })
  })

  it('несколько фото грузятся по одному и уходят в порядке выбора', async () => {
    const order: string[] = []
    const onUpload = vi.fn(async () => {
      const id = `m${order.length + 1}`
      order.push(id)
      return id
    })
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} onUpload={onUpload} />)
    pick([jpeg('1.jpg'), jpeg('2.jpg'), jpeg('3.jpg')])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledWith({ text: '', mediaIds: ['m1', 'm2', 'm3'] })
  })

  it('пока фото грузится, отправить нельзя', async () => {
    let finish!: (id: string) => void
    const onUpload = vi.fn(() => new Promise<string>((r) => (finish = r)))
    render(<Composer onSend={vi.fn()} onUpload={onUpload} />)
    pick([jpeg()])
    await waitFor(() => expect(onUpload).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    await act(async () => finish('m1'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
  })

  it('загрузка не удалась: причина показана, отправить нельзя, «Ещё раз» повторяет без повторного выбора', async () => {
    const onUpload = vi.fn().mockRejectedValueOnce(new ApiError(413, 'media_quota')).mockResolvedValue('m1')
    render(<Composer onSend={vi.fn()} onUpload={onUpload} />)
    pick([jpeg()])
    expect(await screen.findByText(/Место для фото у семьи закончилось/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить загрузку фото 1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    expect(onUpload).toHaveBeenCalledTimes(2)
    // повторно фото не уменьшалось
    expect(resize).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Место для фото/)).toBeNull()
  })

  it('фото не удалось подготовить: повтор не предлагается, можно убрать', async () => {
    resize.mockRejectedValueOnce(new ImageError('decode_failed'))
    const onUpload = vi.fn()
    render(<Composer onSend={vi.fn()} onUpload={onUpload} />)
    pick([jpeg()])
    expect(await screen.findByText(/Не удалось открыть фото/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Повторить загрузку/ })).toBeNull()
    expect(onUpload).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Убрать фото 1' }))
    expect(screen.queryByAltText('Фото 1')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
  })

  it('убрать загруженное фото: оно не уходит в сообщение', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const onUpload = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b')
    render(<Composer onSend={onSend} onUpload={onUpload} />)
    pick([jpeg(), jpeg()])
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2))
    await userEvent.click(screen.getByRole('button', { name: 'Убрать фото 1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenCalledWith({ text: '', mediaIds: ['b'] })
  })

  it('больше десяти фото не берётся, сказано почему; кнопка вложения блокируется на десяти', async () => {
    const onUpload = vi.fn().mockResolvedValue('m')
    render(<Composer onSend={vi.fn()} onUpload={onUpload} />)
    pick(Array.from({ length: 12 }, (_, i) => jpeg(`${i}.jpg`)))
    expect(await screen.findByText(/не больше 10 фото/)).toBeInTheDocument()
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(10))
    expect(within(screen.getByLabelText('Выбранные фото')).getAllByRole('img')).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Прикрепить фото' })).toBeDisabled()
  })

  it('не изображения пропускаются с пояснением', async () => {
    const onUpload = vi.fn().mockResolvedValue('m')
    render(<Composer onSend={vi.fn()} onUpload={onUpload} />)
    pick([new File(['x'], 'a.pdf', { type: 'application/pdf' })])
    expect(await screen.findByText(/другие файлы не поддерживаются/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Выбранные фото')).toBeNull()
    expect(resize).not.toHaveBeenCalled()
  })

  it('ошибка отправки: фото и подпись остаются, загружать заново не нужно', async () => {
    const onUpload = vi.fn().mockResolvedValue('m1')
    const onSend = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Composer onSend={onSend} onUpload={onUpload} />)
    pick([jpeg()])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    await user.type(screen.getByLabelText('Подпись к фото'), 'вот')
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(await screen.findByText(/Не удалось отправить сообщение/)).toBeInTheDocument()
    expect(screen.getByAltText('Фото 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Подпись к фото')).toHaveValue('вот')
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(onSend).toHaveBeenLastCalledWith({ text: 'вот', mediaIds: ['m1'] })
    expect(onUpload).toHaveBeenCalledTimes(1)
  })

  it('двойное нажатие «Отправить» отправляет сообщение с фото один раз', async () => {
    let finish!: () => void
    const onSend = vi.fn(() => new Promise<void>((r) => (finish = r)))
    render(<Composer onSend={onSend} onUpload={vi.fn().mockResolvedValue('m1')} />)
    pick([jpeg()])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled())
    const send = screen.getByRole('button', { name: 'Отправить' })
    act(() => {
      fireEvent.click(send)
      fireEvent.click(send)
    })
    expect(onSend).toHaveBeenCalledTimes(1)
    await act(async () => finish())
  })
})

describe('MessageBubble: фото', () => {
  const view = (m: ChatMessage, onOpenPhoto = vi.fn(), onFeedback?: () => void) =>
    render(<MessageBubble message={m} mine={false} showSender={false} onOpenPhoto={onOpenPhoto} onFeedback={onFeedback} />)

  it('одно фото показывается крупно (полный вариант), заглушки «📷 Фото» нет', () => {
    view(message({ text: '📷 Фото', caption: '', media: [media('a')] }))
    expect(screen.getByRole('button', { name: 'Открыть фото' }).querySelector('img')).toHaveAttribute('src', media('a').fullUrl)
    expect(screen.queryByText('📷 Фото')).toBeNull()
  })

  it('несколько фото плитками из превью, у каждой своя кнопка; нажатие открывает с нужным номером', async () => {
    const onOpenPhoto = vi.fn()
    view(message({ text: 'Вот', caption: 'Вот', media: [media('a'), media('b'), media('c')] }), onOpenPhoto)
    const tiles = screen.getAllByRole('button', { name: /Открыть фото \d из 3/ })
    expect(tiles).toHaveLength(3)
    expect(tiles[1].querySelector('img')).toHaveAttribute('src', media('b').thumbUrl)
    await userEvent.click(tiles[2])
    expect(onOpenPhoto).toHaveBeenCalledWith(2)
    expect(screen.getByText('Вот')).toBeInTheDocument()
  })

  it('обычное сообщение: только текст, кнопок фото нет', () => {
    view(message())
    expect(screen.getByText('привет')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Открыть фото/ })).toBeNull()
  })

  it('сообщение из кэша прежней версии без media показывается как текст', () => {
    view({ id: 'x', senderId: 'kid', text: 'старое', createdAt: '2026-10-11T10:00:00Z', reactions: [], awards: [] } as unknown as ChatMessage)
    expect(screen.getByText('старое')).toBeInTheDocument()
  })

  it('долгое нажатие открывает окно реакции, а не просмотр', () => {
    vi.useFakeTimers()
    try {
      const onOpenPhoto = vi.fn()
      const onFeedback = vi.fn()
      view(message({ text: '📷 Фото', caption: '', media: [media('a')] }), onOpenPhoto, onFeedback)
      const photo = screen.getByRole('button', { name: 'Открыть фото' })
      fireEvent.pointerDown(photo, { clientX: 5, clientY: 5, pointerType: 'touch' })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(onFeedback).toHaveBeenCalledTimes(1)
      // палец отпускается над фото: браузер присылает click, просмотр открываться не должен
      fireEvent.pointerUp(photo)
      fireEvent.click(photo)
      expect(onOpenPhoto).not.toHaveBeenCalled()
      // а обычное нажатие позже открывает
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      fireEvent.click(photo)
      expect(onOpenPhoto).toHaveBeenCalledWith(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('PhotoViewer', () => {
  const photos = [media('a'), media('b'), media('c')]
  const open = (index = 0) => {
    const onClose = vi.fn()
    const onIndexChange = vi.fn<(i: number) => void>()
    render(<PhotoViewer photos={photos} index={index} onIndexChange={onIndexChange} onClose={onClose} />)
    return { onClose, onIndexChange }
  }

  it('показывает полный вариант, номер и ссылку «Сохранить»', () => {
    open(1)
    expect(screen.getByRole('dialog', { name: 'Просмотр фото' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Фото 2' })).toHaveAttribute('src', media('b').fullUrl)
    expect(screen.getByText('2 из 3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Сохранить фото' })).toHaveAttribute('href', media('b').fullUrl)
  })

  it('кнопки листают по кругу', async () => {
    const { onIndexChange } = open(2)
    await userEvent.click(screen.getByRole('button', { name: 'Следующее фото' }))
    expect(onIndexChange).toHaveBeenLastCalledWith(0)
    await userEvent.click(screen.getByRole('button', { name: 'Предыдущее фото' }))
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
  })

  it('стрелки клавиатуры листают, Escape закрывает', () => {
    const { onIndexChange, onClose } = open(0)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(onIndexChange).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('жест влево — следующее, вправо — предыдущее; короткий или вертикальный не листает', () => {
    const { onIndexChange } = open(1)
    const dialog = screen.getByRole('dialog')
    const swipe = (from: [number, number], to: [number, number]) => {
      fireEvent.pointerDown(dialog, { clientX: from[0], clientY: from[1] })
      fireEvent.pointerUp(dialog, { clientX: to[0], clientY: to[1] })
    }
    swipe([200, 100], [100, 105])
    expect(onIndexChange).toHaveBeenLastCalledWith(2)
    swipe([100, 100], [200, 100])
    expect(onIndexChange).toHaveBeenLastCalledWith(0)
    onIndexChange.mockClear()
    swipe([100, 100], [130, 100])
    swipe([100, 100], [180, 300])
    expect(onIndexChange).not.toHaveBeenCalled()
  })

  it('закрытие: кнопка и нажатие на фон, но не на само фото', async () => {
    const { onClose } = open(0)
    await userEvent.click(screen.getByRole('img', { name: 'Фото 1' }))
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('img', { name: 'Фото 1' }).parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('одно фото: ни номера, ни стрелок; прокрутка страницы блокируется, пока просмотр открыт', () => {
    document.body.style.overflow = ''
    const { unmount } = render(<PhotoViewer photos={[media('a')]} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Следующее фото' })).toBeNull()
    expect(screen.queryByText(/из/)).toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
