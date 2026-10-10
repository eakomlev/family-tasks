import { request, send } from '../client'
import type { CreateFamilyResult, FamilyOverview, SignupData } from './types'

export const createFamily = (data: SignupData) =>
  request<CreateFamilyResult>('/families', send('POST', data))

// текущий участник и состав семьи
export const getMe = (token: string) => request<FamilyOverview>('/me', {}, token)

export type * from './types'
