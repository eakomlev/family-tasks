import { beforeEach, describe, expect, it } from 'vitest'
import { memoryStore, setKv } from '@/lib/kv'
import { markOnboardingSeen, markOnboardingSkipped, resetOnboardingSkipped, shouldShowOnboarding } from '@/features/onboarding/state'

beforeEach(() => {
  setKv(memoryStore())
  resetOnboardingSkipped()
})

describe('слайдер знакомства', () => {
  it('при первом запуске показывается', () => {
    expect(shouldShowOnboarding()).toBe(true)
  })

  it('после полного просмотра больше не появляется', () => {
    markOnboardingSeen()
    expect(shouldShowOnboarding()).toBe(false)
  })

  it('«Пропустить» прячет слайды только на этот запуск', () => {
    markOnboardingSkipped()
    expect(shouldShowOnboarding()).toBe(false)
    resetOnboardingSkipped()
    expect(shouldShowOnboarding()).toBe(true)
  })
})
