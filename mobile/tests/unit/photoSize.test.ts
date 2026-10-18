import { describe, expect, it } from 'vitest'
import { fitSize } from '@/lib/photoSize'

describe('fitSize', () => {
  it('большое горизонтальное фото ужимается до 1600 по длинной стороне', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
  })

  it('вертикальное тоже по длинной стороне', () => {
    expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('маленькое фото не увеличивается', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(fitSize(1600, 1600)).toEqual({ width: 1600, height: 1600 })
  })
})
