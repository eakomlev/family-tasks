import { beforeEach, describe, expect, it } from 'vitest'
import { applyFontScale, clampFontScale, getFontScale, setFontScale } from '@/lib/fontScale'

describe('размер шрифта', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.fontSize = ''
  })

  it('ограничивает и округляет до шага', () => {
    expect(clampFontScale(3)).toBe(1.5)
    expect(clampFontScale(0.1)).toBe(0.8)
    expect(clampFontScale(1.123)).toBe(1.1)
    expect(clampFontScale(Number.NaN)).toBe(1)
  })

  it('запоминает и применяет, стандартный размер ничего не хранит', () => {
    expect(getFontScale()).toBe(1)
    setFontScale(1.25)
    expect(getFontScale()).toBe(1.25)
    expect(document.documentElement.style.fontSize).toBe('125%')
    setFontScale(1)
    expect(localStorage.getItem('fontScale')).toBeNull()
    expect(document.documentElement.style.fontSize).toBe('')
    applyFontScale(0.9)
    expect(document.documentElement.style.fontSize).toBe('90%')
  })
})
