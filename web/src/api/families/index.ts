import { request, send } from '../client'
import type { Role } from '@/lib/roles'
import type { CreateFamilyResult, FamilyOverview, SignupData } from './types'

export const createFamily = (data: SignupData) =>
  request<CreateFamilyResult>('/families', send('POST', data))

// текущий участник и состав семьи
export const getMe = (token: string) => request<FamilyOverview>('/me', {}, token)

// Заявка на удаление семьи (только создатель): данные и файлы удалит планировщик в ближайшую минуту-две
export const requestFamilyDeletion = (token: string) => request<{ requestedAt: string }>('/family/deletion', send('POST'), token)

export type * from './types'

// Убрать участника (только создатель семьи): взрослый теряет аккаунт в этой семье, аккаунт ребёнка удаляется полностью
export const removeMember = (token: string, memberId: string) => request<void>(`/members/${memberId}`, send('DELETE'), token)

// Участник без семьи (создатель убрал его из семьи): создать новую семью или вступить в другую по коду приглашения
export interface MemberFamilyResult {
  family: { code: string }
  member: { id: string; name: string; role: Role; isOwner: boolean }
}
export const createFamilyForMe = (token: string, role: 'mama' | 'papa') => request<MemberFamilyResult>('/me/family', send('POST', { role }), token)
export const joinFamilyAsMe = (token: string, inviteCode: string, role: 'mama' | 'papa' | 'grandma' | 'grandpa') =>
  request<MemberFamilyResult>('/me/join', send('POST', { inviteCode, role }), token)
