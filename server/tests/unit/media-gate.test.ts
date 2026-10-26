import { describe, expect, it } from 'vitest'
import { createUploadGate } from '../../src/media/index.js'

describe('ограничитель одновременных загрузок видео', () => {
  it('всего не больше заданного числа, от одной семьи одна', () => {
    const gate = createUploadGate(2, 1)
    const a = gate.acquire('fam-a')
    expect(a).toBeTypeOf('function')
    // у той же семьи вторая загрузка не проходит
    expect(gate.acquire('fam-a')).toBeNull()
    const b = gate.acquire('fam-b')
    expect(b).toBeTypeOf('function')
    // общий предел
    expect(gate.acquire('fam-c')).toBeNull()
    a!()
    expect(gate.acquire('fam-c')).toBeTypeOf('function')
    b!()
  })

  it('повторное освобождение не освобождает чужое место', () => {
    const gate = createUploadGate(1, 1)
    const a = gate.acquire('fam-a')!
    a()
    const b = gate.acquire('fam-b')
    expect(b).toBeTypeOf('function')
    a()
    expect(gate.acquire('fam-c')).toBeNull()
  })
})
