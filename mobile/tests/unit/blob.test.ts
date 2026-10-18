import { describe, expect, it } from 'vitest'
import { withType } from '@/lib/blob'

describe('withType', () => {
  it('задаёт тип блобу без типа и сохраняет содержимое', async () => {
    const source = new Blob(['abc'])
    expect(source.type).toBe('')
    const typed = withType(source, 'image/jpeg')
    expect(typed.type).toBe('image/jpeg')
    expect(await typed.text()).toBe('abc')
  })
})
