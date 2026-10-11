import { describe, expect, it } from 'vitest'
import { familyCode, hashToken, inviteCode, memberToken } from '../../src/codes.js'

describe('коды', () => {
  it('код семьи: 8 символов без похожих (0/o, 1/l/i)', () => {
    for (let i = 0; i < 50; i++) expect(familyCode()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/)
    expect(familyCode(12)).toHaveLength(12)
  })

  it('приглашения и токены случайные и достаточно длинные', () => {
    expect(inviteCode()).toHaveLength(22)
    expect(memberToken()).toHaveLength(43)
    expect(new Set(Array.from({ length: 100 }, memberToken)).size).toBe(100)
  })

  it('хэш токена стабилен и необратим к исходному виду', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})
