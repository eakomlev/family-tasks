import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/api'
import { discardPending, getPending, isPendingId, pendingToMessage, resetPending, retrySend, startSend, type PendingDraft } from '@/features/chat/pending'

const draft: PendingDraft = { chat: 'family', text: 'Привет', mediaIds: [], fileIds: [], videoIds: [], photoUris: [], files: [], videos: [] }
const sent = (id = 'srv-1'): ChatMessage => ({ id, senderId: 'me', text: 'Привет', caption: 'Привет', media: [], createdAt: '2026-10-12T10:00:00.000Z', reactions: [], awards: [] })
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => resetPending())

describe('сообщения, которые ещё уходят', () => {
  it('появляются сразу, до ответа сервера', () => {
    startSend(draft, () => new Promise(() => {}))
    const [item] = getPending()
    expect(item).toMatchObject({ status: 'sending', text: 'Привет', chat: 'family' })
    expect(isPendingId(item.id)).toBe(true)
  })

  it('без открытой переписки ушедшее сообщение просто убирается', async () => {
    startSend(draft, async () => sent())
    await flush()
    expect(getPending()).toHaveLength(0)
  })

  it('неудачная отправка оставляет сообщение с ошибкой', async () => {
    startSend(draft, async () => {
      throw new Error('нет связи')
    })
    await flush()
    expect(getPending()[0].status).toBe('failed')
  })

  it('повтор отправляет то же сообщение ещё раз и при успехе убирает его', async () => {
    let attempts = 0
    startSend(draft, async () => {
      attempts++
      if (attempts === 1) throw new Error('нет связи')
      return sent()
    })
    await flush()
    retrySend(getPending()[0].id)
    expect(getPending()[0].status).toBe('sending')
    await flush()
    expect(attempts).toBe(2)
    expect(getPending()).toHaveLength(0)
  })

  it('повтор не запускается, пока сообщение ещё уходит', async () => {
    let attempts = 0
    startSend(draft, () => {
      attempts++
      return new Promise(() => {})
    })
    retrySend(getPending()[0].id)
    expect(attempts).toBe(1)
  })

  it('неудавшееся сообщение можно удалить', async () => {
    startSend(draft, async () => {
      throw new Error('нет связи')
    })
    await flush()
    discardPending(getPending()[0].id)
    expect(getPending()).toHaveLength(0)
  })

  it('в ленте выглядит как обычное сообщение с превью вложений', () => {
    startSend({ ...draft, photoUris: ['file:///a.jpg'], files: [{ name: 'doc.pdf', size: 10 }] }, () => new Promise(() => {}))
    const message = pendingToMessage(getPending()[0], 'me')
    expect(message).toMatchObject({ senderId: 'me', text: 'Привет' })
    expect(message.media[0].thumbUrl).toBe('file:///a.jpg')
    expect(message.files?.[0].name).toBe('doc.pdf')
  })
})
