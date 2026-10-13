import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MAX_FUTURE_SECONDS, sign, verify } from '../../src/sign.js'

// Контрольный пример из общего контракта: тот же проверяет server, так подпись не расходится.
const { sign: vector } = JSON.parse(readFileSync(new URL('../../../contracts/media-v1.json', import.meta.url), 'utf8'))
const NOW = vector.exp - 3600

describe('подпись ссылок', () => {
  it('совпадает с контрольным примером контракта', () => {
    expect(sign(vector.secret, vector.family, vector.id, vector.exp)).toBe(vector.sig)
  })

  it('верная подпись принимается', () => {
    expect(verify(vector.secret, vector.family, vector.id, vector.exp, vector.sig, NOW)).toBe(true)
  })

  it.each([
    ['другой секрет', (v: any) => verify('другой', v.family, v.id, v.exp, v.sig, NOW)],
    ['другой файл', (v: any) => verify(v.secret, v.family, '33333333-3333-4333-8333-333333333333', v.exp, v.sig, NOW)],
    ['другая семья', (v: any) => verify(v.secret, '33333333-3333-4333-8333-333333333333', v.id, v.exp, v.sig, NOW)],
    ['срок изменён', (v: any) => verify(v.secret, v.family, v.id, v.exp + 1, v.sig, NOW)],
    ['подпись обрезана', (v: any) => verify(v.secret, v.family, v.id, v.exp, v.sig.slice(0, 10), NOW)],
    ['подпись не hex', (v: any) => verify(v.secret, v.family, v.id, v.exp, 'zz'.repeat(32), NOW)],
    ['пустая подпись', (v: any) => verify(v.secret, v.family, v.id, v.exp, '', NOW)],
  ])('отклоняется: %s', (_name, check) => {
    expect(check(vector)).toBe(false)
  })

  it('срок: истёк (в том числе ровно сейчас) и слишком далёкий не принимаются', () => {
    expect(verify(vector.secret, vector.family, vector.id, vector.exp, vector.sig, vector.exp)).toBe(false)
    expect(verify(vector.secret, vector.family, vector.id, vector.exp, vector.sig, vector.exp + 10)).toBe(false)
    // подпись верна, но срок дальше допустимого окна
    const far = vector.exp
    expect(verify(vector.secret, vector.family, vector.id, far, sign(vector.secret, vector.family, vector.id, far), far - MAX_FUTURE_SECONDS - 1)).toBe(false)
    expect(verify(vector.secret, vector.family, vector.id, far, sign(vector.secret, vector.family, vector.id, far), far - MAX_FUTURE_SECONDS)).toBe(true)
  })

  it('срок не целое число: отклоняется', () => {
    expect(verify(vector.secret, vector.family, vector.id, NaN, vector.sig, NOW)).toBe(false)
    expect(verify(vector.secret, vector.family, vector.id, 1.5, vector.sig, 0)).toBe(false)
  })
})
