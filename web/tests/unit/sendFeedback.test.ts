import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSendSoundOn, playSendFeedback, setSendSoundOn } from '@/lib/sendFeedback'

describe('отклик на отправку', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('по умолчанию включён, выключение запоминается', () => {
    expect(isSendSoundOn()).toBe(true)
    setSendSoundOn(false)
    expect(isSendSoundOn()).toBe(false)
    setSendSoundOn(true)
    expect(isSendSoundOn()).toBe(true)
  })

  it('вибрирует, когда включён, и молчит, когда выключен', () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    playSendFeedback()
    expect(vibrate).toHaveBeenCalledTimes(1)
    setSendSoundOn(false)
    playSendFeedback()
    expect(vibrate).toHaveBeenCalledTimes(1)
  })
})
