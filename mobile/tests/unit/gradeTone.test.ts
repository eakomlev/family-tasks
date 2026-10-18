import { describe, expect, it } from 'vitest'
import { GRADES } from '@/lib/lessonReport'
import { gradeTone } from '@/features/lessonReport/gradeTone'

describe('gradeTone', () => {
  it('у каждой оценки свой цвет', () => {
    expect(new Set(GRADES.map(gradeTone)).size).toBe(4)
  })
})
