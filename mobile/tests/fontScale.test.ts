import { beforeEach, describe, expect, it } from 'vitest'
import { getKv } from '@/lib/kv'
import { getFontScale, normalizeFontScale, resetFontScale, setFontScale } from '@/theme/fontScale'

describe('normalizeFontScale', () => {
  it('стандартный размер для пустого и испорченного значения', () => {
    expect(normalizeFontScale(null)).toBe(1)
    expect(normalizeFontScale('abc')).toBe(1)
    expect(normalizeFontScale(undefined)).toBe(1)
  })

  it('держит значение в пределах и кратным шагу', () => {
    expect(normalizeFontScale(0.1)).toBe(0.8)
    expect(normalizeFontScale(9)).toBe(1.5)
    expect(normalizeFontScale('1.16')).toBe(1.15)
    expect(normalizeFontScale(1.2)).toBe(1.2)
  })
})

describe('размер шрифта на устройстве', () => {
  beforeEach(() => {
    getKv().removeItem('fontScale')
    resetFontScale()
  })

  it('сохраняется и читается заново', () => {
    setFontScale(1.3)
    expect(getKv().getItem('fontScale')).toBe('1.3')
    resetFontScale()
    expect(getFontScale()).toBe(1.3)
  })

  it('стандартный размер ничего не хранит', () => {
    setFontScale(1.3)
    setFontScale(1)
    expect(getKv().getItem('fontScale')).toBeNull()
    expect(getFontScale()).toBe(1)
  })
})
