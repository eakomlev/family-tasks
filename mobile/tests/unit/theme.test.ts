import { beforeEach, describe, expect, it } from 'vitest'
import { memoryStore, setKv } from '@/lib/kv'
import { getThemePreference, resetThemePreference, setThemePreference } from '@/theme/preference'

describe('выбор темы', () => {
  beforeEach(() => {
    setKv(memoryStore())
    resetThemePreference()
  })

  it('по умолчанию тема как в системе', () => {
    expect(getThemePreference()).toBe('system')
  })

  it('явный выбор запоминается и читается заново', () => {
    setThemePreference('dark')
    expect(getThemePreference()).toBe('dark')
    resetThemePreference()
    expect(getThemePreference()).toBe('dark')
  })

  it('«как в системе» стирает запомненное', () => {
    setThemePreference('light')
    setThemePreference('system')
    resetThemePreference()
    expect(getThemePreference()).toBe('system')
  })
})
