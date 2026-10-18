import { request, send } from '../client'
import type { Training } from './types'

export const getTrainings = (token: string, memberId: string) =>
  request<{ trainings: Training[] }>(`/members/${encodeURIComponent(memberId)}/trainings`, {}, token)

// расписание сохраняется целиком; порядок тренировок в дне равен порядку в массиве
export const saveTrainings = (token: string, memberId: string, trainings: Training[]) =>
  request<void>(`/members/${encodeURIComponent(memberId)}/trainings`, send('PUT', { trainings }), token)

export type * from './types'
