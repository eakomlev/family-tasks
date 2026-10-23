import { describe, expect, it } from 'vitest'
import type { ResolvedSharePayload } from 'expo-sharing'
import { classifyShared, describeShared, emptyShared, hasShared, setPendingShare, takePendingShare } from '@/lib/incomingShare'

const text = (value: string): ResolvedSharePayload => ({ value, shareType: 'text', mimeType: 'text/plain', contentUri: null, contentType: 'text', contentMimeType: null, originalName: null, contentSize: null })
const uri = (contentType: 'image' | 'video' | 'audio' | 'file' | 'website', contentUri: string, name: string | null, size: number | null): ResolvedSharePayload => ({
  value: contentUri,
  shareType: contentType === 'website' ? 'url' : contentType === 'image' ? 'image' : 'file',
  mimeType: 'application/octet-stream',
  contentUri,
  contentType,
  contentMimeType: null,
  originalName: name,
  contentSize: size,
})

describe('classifyShared', () => {
  it('текст и ссылки склеиваются, пустое отбрасывается', () => {
    const content = classifyShared([text('  Привет  '), text('   '), text('https://example.com')])
    expect(content.text).toBe('Привет\n\nhttps://example.com')
    expect(content.images).toEqual([])
  })

  it('картинки идут фото, остальное файлами', () => {
    const content = classifyShared([
      uri('image', 'content://media/1', 'a.jpg', 1000),
      uri('video', 'content://media/2', 'clip.mp4', 5000),
      uri('file', 'content://docs/3', null, null),
      uri('audio', 'content://media/4', 'song.mp3', 10),
    ])
    expect(content.images).toEqual([{ uri: 'content://media/1', name: 'a.jpg', size: 1000 }])
    expect(content.files.map((f) => f.name)).toEqual(['clip.mp4', '3', 'song.mp3'])
    expect(content.files[1].size).toBe(0)
  })

  it('имя берётся из адреса, если приложение его не прислало', () => {
    expect(classifyShared([uri('file', 'file:///cache/%D0%BE%D1%82%D1%87%D1%91%D1%82.pdf?x=1', null, 5)]).files[0].name).toBe('отчёт.pdf')
  })

  it('ссылка на сайт остаётся текстом, а не файлом', () => {
    expect(classifyShared([{ ...uri('website', 'https://example.com/page', null, null), value: 'https://example.com/page' }])).toMatchObject({ text: 'https://example.com/page', files: [] })
  })
})

describe('describeShared и hasShared', () => {
  it('пустое и непустое', () => {
    expect(hasShared(emptyShared())).toBe(false)
    expect(hasShared({ ...emptyShared(), text: 'a' })).toBe(true)
  })

  it('описание для экрана выбора чата', () => {
    expect(describeShared({ text: 'Привет', images: [{ uri: 'u', name: 'a', size: 1 }], files: [] })).toBe('Привет · 1 фото')
    expect(describeShared({ text: '', images: [], files: [{ uri: 'u', name: 'отчёт.pdf', size: 1 }] })).toBe('Файл: отчёт.pdf')
    expect(describeShared({ text: 'x'.repeat(200), images: [], files: [] }).length).toBeLessThanOrEqual(80)
  })
})

describe('ожидающее содержимое', () => {
  it('читается один раз', () => {
    setPendingShare({ ...emptyShared(), text: 'привет' })
    expect(takePendingShare()?.text).toBe('привет')
    expect(takePendingShare()).toBeNull()
  })
})
