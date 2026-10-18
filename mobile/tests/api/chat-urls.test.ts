import { describe, expect, it } from 'vitest'
import { absoluteUrl, absolutizeMessage, type ChatMessage } from '@/api'

const base = 'https://family.test'

describe('адреса фото и файлов', () => {
  it('относительный адрес получает адрес сервера, полный остаётся', () => {
    expect(absoluteUrl('/media/f/p/thumb?exp=1&sig=a')).toBe(`${base}/media/f/p/thumb?exp=1&sig=a`)
    expect(absoluteUrl('https://cdn.test/x.jpg')).toBe('https://cdn.test/x.jpg')
  })

  it('в сообщении исправляются фото и файлы, остальное без изменений', () => {
    const message: ChatMessage = {
      id: 'm1',
      senderId: 'u1',
      text: 't',
      caption: 't',
      media: [{ id: 'p1', width: 10, height: 10, thumbUrl: '/media/a/thumb', fullUrl: '/media/a/full' }],
      files: [{ id: 'f1', name: 'a.pdf', size: 3, url: '/media/f/file?name=a.pdf' }],
      createdAt: '2026-10-12T10:00:00Z',
      reactions: [],
      awards: [],
    }
    const out = absolutizeMessage(message)
    expect(out.media[0].thumbUrl).toBe(`${base}/media/a/thumb`)
    expect(out.media[0].fullUrl).toBe(`${base}/media/a/full`)
    expect(out.files?.[0].url).toBe(`${base}/media/f/file?name=a.pdf`)
    expect(out.caption).toBe('t')
  })

  it('сообщение без фото (старый кэш) не ломается', () => {
    const out = absolutizeMessage({ id: 'm', senderId: 'u', text: 'a', caption: 'a', createdAt: '', reactions: [], awards: [] } as unknown as ChatMessage)
    expect(out.media).toEqual([])
  })
})
