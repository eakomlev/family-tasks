import { describe, expect, it } from 'vitest'
import type { ChatMessage, ChatSummary, Member } from '@/api'
import { chatPreviewParts } from '@/pages/Chat/utils'
import { bubbleText, canSendMessage, MAX_LENGTH, MAX_PHOTOS, nextIndex, photoColumns, prevIndex } from '@/pages/ChatRoom/utils'

const photo = (id: string) => ({ id, width: 800, height: 600, thumbUrl: `/media/f/${id}/thumb?exp=1&sig=a`, fullUrl: `/media/f/${id}/full?exp=1&sig=a` })
const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm', senderId: 's', text: 'привет', caption: 'привет', media: [], createdAt: '2026-10-11T10:00:00Z', reactions: [], awards: [], ...over,
})

describe('bubbleText: что показывать в пузыре', () => {
  it('обычное сообщение: текст', () => {
    expect(bubbleText(msg())).toBe('привет')
  })

  it('фото без подписи: пусто, заглушку «📷 Фото» видят только старые версии', () => {
    expect(bubbleText(msg({ text: '📷 Фото', caption: '', media: [photo('a')] }))).toBe('')
  })

  it('фото с подписью: подпись', () => {
    expect(bubbleText(msg({ text: 'Смотри', caption: 'Смотри', media: [photo('a')] }))).toBe('Смотри')
  })

  it('сообщение из кэша прежней версии (без caption и media) считается текстовым', () => {
    expect(bubbleText({ id: 'm', senderId: 's', text: 'старое', createdAt: 'x', reactions: [], awards: [] } as unknown as ChatMessage)).toBe('старое')
  })
})

describe('раскладка фото', () => {
  it.each([[1, 1], [2, 2], [3, 2], [4, 2], [5, 3], [10, 3]])('%i фото: %i столбца', (count, columns) => {
    expect(photoColumns(count)).toBe(columns)
  })
})

describe('canSendMessage', () => {
  const done = { status: 'done' as const }
  it('текст без фото и фото без текста можно, пустое нельзя', () => {
    expect(canSendMessage('привет', [])).toBe(true)
    expect(canSendMessage('   ', [done])).toBe(true)
    expect(canSendMessage('   ', [])).toBe(false)
    expect(canSendMessage('', [])).toBe(false)
  })

  it('пока фото грузится или не загрузилось, отправить нельзя', () => {
    expect(canSendMessage('привет', [done, { status: 'uploading' }])).toBe(false)
    expect(canSendMessage('привет', [{ status: 'failed' }])).toBe(false)
  })

  it('слишком длинный текст нельзя даже с фото', () => {
    expect(canSendMessage('а'.repeat(MAX_LENGTH + 1), [done])).toBe(false)
    expect(canSendMessage('а'.repeat(MAX_LENGTH), [done])).toBe(true)
  })

  it('предел фото совпадает с серверным', () => {
    expect(MAX_PHOTOS).toBe(10)
  })
})

describe('листание фото по кругу', () => {
  it('вперёд и назад с переходом через край', () => {
    expect(nextIndex(0, 3)).toBe(1)
    expect(nextIndex(2, 3)).toBe(0)
    expect(prevIndex(0, 3)).toBe(2)
    expect(prevIndex(2, 3)).toBe(1)
    expect(nextIndex(0, 1)).toBe(0)
  })
})

describe('превью последнего сообщения в списке чатов', () => {
  const members: Member[] = [{ id: 'm2', name: 'Миша', role: 'child', avatar: null, isOwner: false }]
  const chat = (last: ChatMessage): ChatSummary => ({ id: 'family', last, unread: 0 })
  const preview = (last: ChatMessage) => chatPreviewParts(chat(last), 'me', members, 'mama')

  it('фото без подписи: «📷 Фото» и «📷 3 фото»', () => {
    expect(preview(msg({ senderId: 'm2', text: '📷 Фото', caption: '', media: [photo('a')] })).text).toBe('📷 Фото')
    expect(preview(msg({ senderId: 'm2', text: '📷 Фото ×3', caption: '', media: [photo('a'), photo('b'), photo('c')] })).text).toBe('📷 3 фото')
  })

  it('фото с подписью: «📷 подпись» одной строкой', () => {
    expect(preview(msg({ senderId: 'm2', text: 'Вот\nмой рисунок', caption: 'Вот\nмой рисунок', media: [photo('a')] })).text).toBe('📷 Вот мой рисунок')
  })

  it('автор по-прежнему подписан', () => {
    expect(preview(msg({ senderId: 'me', caption: '', media: [photo('a')] })).prefix).toBe('Вы:')
    expect(preview(msg({ senderId: 'm2', caption: '', media: [photo('a')] })).prefix).toBe('Миша:')
  })

  it('обычный текст как раньше; кэш прежней версии без media не ломает', () => {
    expect(preview(msg({ senderId: 'm2', text: 'привет' })).text).toBe('привет')
    expect(preview({ id: 'x', senderId: 'm2', text: 'старое', createdAt: 'x', reactions: [], awards: [] } as unknown as ChatMessage).text).toBe('старое')
  })
})
