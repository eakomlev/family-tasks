import { describe, expect, it } from 'vitest'
import { photoCacheKey } from '../../src/lib/photoCache'

describe('photoCacheKey', () => {
  it('ключ без подписи и срока: ссылка на то же фото в другие сутки даёт тот же ключ', () => {
    const a = photoCacheKey('https://family.test/media/f1/m1/thumb?exp=1&sig=aa')
    const b = photoCacheKey('https://family.test/media/f1/m1/thumb?exp=2&sig=bb')
    expect(a).toBe('https://family.test/media/f1/m1/thumb')
    expect(a).toBe(b)
  })

  it('превью и полный вариант кэшируются отдельно', () => {
    expect(photoCacheKey('https://family.test/media/f1/m1/full?exp=1&sig=aa')).not.toBe(photoCacheKey('https://family.test/media/f1/m1/thumb?exp=1&sig=aa'))
  })

  it('локальные и чужие адреса без ключа', () => {
    expect(photoCacheKey('file:///data/photo.jpg')).toBeUndefined()
    expect(photoCacheKey('https://example.com/pic.jpg?x=1')).toBeUndefined()
  })
})
