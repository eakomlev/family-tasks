import { describe, expect, it } from 'vitest'
import { withAlpha } from '@/lib/colorAlpha'

describe('withAlpha', () => {
  it('переводит шестизначный цвет в rgba с нужной прозрачностью', () => {
    expect(withAlpha('#161a33', 0.6)).toBe('rgba(22, 26, 51, 0.6)')
    expect(withAlpha('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)')
  })

  it('понимает короткую запись и запись без решётки', () => {
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(withAlpha('0b0e1f', 1)).toBe('rgba(11, 14, 31, 1)')
  })

  it('нечитаемый цвет возвращает как есть, а не ломает экран', () => {
    expect(withAlpha('rgba(1, 2, 3, 0.4)', 0.5)).toBe('rgba(1, 2, 3, 0.4)')
    expect(withAlpha('transparent', 0.5)).toBe('transparent')
  })
})
