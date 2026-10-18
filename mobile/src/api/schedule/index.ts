import { request, send } from '../client'
import type { Lesson } from './types'

export const getSchedule = (token: string, memberId: string) =>
  request<{ lessons: Lesson[] }>(`/members/${encodeURIComponent(memberId)}/schedule`, {}, token)

// расписание сохраняется целиком; порядок уроков в дне равен порядку в массиве
export const saveSchedule = (token: string, memberId: string, lessons: Lesson[]) =>
  request<void>(`/members/${encodeURIComponent(memberId)}/schedule`, send('PUT', { lessons }), token)

export type * from './types'
