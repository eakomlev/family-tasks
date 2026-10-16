// Роли участников семьи. Бабушка и дедушка видят всё, что родители, но ничего не меняют у детей:
// расписания, цели и монеты остаются за мамой и папой.
export type Role = 'mama' | 'papa' | 'grandma' | 'grandpa' | 'child'

export const ROLES: Role[] = ['mama', 'papa', 'grandma', 'grandpa', 'child']

// родители: управляют детьми (расписания, цели, монеты, подтверждение заданий, очистка чата)
export const PARENT_ROLES = ['mama', 'papa'] as const
export const isParent = (role: string): boolean => role === 'mama' || role === 'papa'

// взрослые видят то же, что родители
export const isAdult = (role: string): boolean => role !== 'child'

// максимум участников в семье
export const MAX_FAMILY_MEMBERS = 6
