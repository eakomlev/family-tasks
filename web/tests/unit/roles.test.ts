import { describe, expect, it } from 'vitest'
import { isAdult, isParent, JOIN_ROLES, memberLabel, ROLE_LABELS } from '@/lib/roles'

describe('роли', () => {
  it('родители управляют детьми, бабушка и дедушка только смотрят', () => {
    expect(isParent('mama') && isParent('papa')).toBe(true)
    expect(isParent('grandma') || isParent('grandpa') || isParent('child')).toBe(false)
    expect(isParent(undefined)).toBe(false)
  })

  it('взрослые: все, кроме ребёнка', () => {
    for (const role of ['mama', 'papa', 'grandma', 'grandpa'] as const) expect(isAdult(role)).toBe(true)
    expect(isAdult('child')).toBe(false)
    expect(isAdult(undefined)).toBe(false)
  })

  it('присоединиться можно под любой ролью, подписи есть у всех', () => {
    expect(JOIN_ROLES).toEqual(['mama', 'papa', 'grandma', 'grandpa', 'child'])
    expect(ROLE_LABELS.grandma).toBe('Бабушка')
    expect(ROLE_LABELS.grandpa).toBe('Дедушка')
  })

  it('ребёнок видит бабушку и дедушку по ролям, остальные по именам', () => {
    expect(memberLabel({ name: 'Нина', role: 'grandma' }, 'child')).toBe('Бабушка')
    expect(memberLabel({ name: 'Иван', role: 'grandpa' }, 'child')).toBe('Дедушка')
    expect(memberLabel({ name: 'Нина', role: 'grandma' }, 'mama')).toBe('Нина')
  })
})
