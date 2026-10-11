import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPreference, readPreference, resolveTheme } from '@/lib/theme'

function mockSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query.includes('dark'), media: query }))
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#000">'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('тема', () => {
  it('без выбора следует системной', () => {
    mockSystemDark(true)
    expect(readPreference()).toBe('system')
    expect(resolveTheme()).toBe('dark')
    mockSystemDark(false)
    expect(resolveTheme()).toBe('light')
  })

  it('явный выбор записывается в html и localStorage и перекрывает системную', () => {
    mockSystemDark(true)
    applyPreference('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(readPreference()).toBe('light')
    expect(resolveTheme()).toBe('light')
  })

  it('«как в системе» снимает атрибут и очищает хранилище', () => {
    mockSystemDark(false)
    applyPreference('dark')
    applyPreference('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('цвет строки состояния браузера следует теме', () => {
    mockSystemDark(false)
    applyPreference('dark')
    const dark = document.querySelector('meta[name="theme-color"]')!.getAttribute('content')
    applyPreference('light')
    const light = document.querySelector('meta[name="theme-color"]')!.getAttribute('content')
    expect(dark).not.toBe(light)
  })

  it('мусор в localStorage игнорируется', () => {
    localStorage.setItem('theme', 'purple')
    expect(readPreference()).toBe('system')
  })

  it('недоступный localStorage не ломает приложение', () => {
    mockSystemDark(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readPreference()).toBe('system')
    expect(() => applyPreference('dark')).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
