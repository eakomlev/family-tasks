export type Role = 'mama' | 'papa' | 'child'

export const ROLE_LABELS: Record<Role, string> = {
  mama: 'Мама',
  papa: 'Папа',
  child: 'Ребёнок',
}

// Как участника называют в чате: ребёнок видит родителей как «Мама» и «Папа», остальные видят имена.
export function memberLabel(member: { name: string; role: Role }, viewerRole: Role): string {
  return viewerRole === 'child' && member.role !== 'child' ? ROLE_LABELS[member.role] : member.name
}

export const CREATOR_ROLES: Role[] = ['mama', 'papa']
export const JOIN_ROLES: Role[] = ['mama', 'papa', 'child']
