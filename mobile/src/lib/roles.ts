export type Role = 'mama' | 'papa' | 'grandma' | 'grandpa' | 'child'

export const ROLE_LABELS: Record<Role, string> = {
  mama: 'Мама',
  papa: 'Папа',
  grandma: 'Бабушка',
  grandpa: 'Дедушка',
  child: 'Ребёнок',
}

// Как участника называют в чате: ребёнок видит взрослых как «Мама», «Папа», «Бабушка» и «Дедушка», остальные видят имена.
export function memberLabel(member: { name: string; role: Role }, viewerRole: Role): string {
  return viewerRole === 'child' && member.role !== 'child' ? ROLE_LABELS[member.role] : member.name
}

export const CREATOR_ROLES: Role[] = ['mama', 'papa']
export const JOIN_ROLES: Role[] = ['mama', 'papa', 'grandma', 'grandpa', 'child']

// максимум участников в семье (проверяет сервер)
export const MAX_FAMILY_MEMBERS = 6

// Родители (мама, папа) управляют детьми: расписания, цели, монеты, проверка заданий.
export const isParent = (role: Role | undefined): boolean => role === 'mama' || role === 'papa'

// Взрослые (родители, бабушка, дедушка) видят все задания и данные детей; менять многое могут только родители.
export const isAdult = (role: Role | undefined): boolean => role !== undefined && role !== 'child'

// Куда ведёт «к заданиям»: у ребёнка вкладки «Задачи» нет, его задания на «Моём дне»
export const tasksHome = (role: Role | undefined): '/' | '/tasks' => (role === 'child' ? '/' : '/tasks')
