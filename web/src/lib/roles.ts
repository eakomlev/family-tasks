export type Role = 'mama' | 'papa' | 'child'

export const ROLE_LABELS: Record<Role, string> = {
  mama: 'Мама',
  papa: 'Папа',
  child: 'Ребёнок',
}

export const CREATOR_ROLES: Role[] = ['mama', 'papa']
export const JOIN_ROLES: Role[] = ['mama', 'papa', 'child']
