import { request, send } from '../client'
import type { CreateFamilyResult, FamilyOverview, SignupData } from './types'

export const createFamily = (data: SignupData) =>
  request<CreateFamilyResult>('/families', send('POST', data))

// текущий участник и состав семьи
export const getMe = (token: string) => request<FamilyOverview>('/me', {}, token)

// Заявка на удаление семьи (только создатель): данные и файлы удалит планировщик в ближайшую минуту-две
export const requestFamilyDeletion = (token: string) => request<{ requestedAt: string }>('/family/deletion', send('POST'), token)

export type * from './types'
