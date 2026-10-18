import { request, send } from '../client'
import type { Goal, GoalInput } from './types'

export const listGoals = (token: string, memberId: string) => request<{ goals: Goal[] }>(`/members/${memberId}/goals`, {}, token)

export const createGoal = (token: string, memberId: string, input: GoalInput) =>
  request<{ goal: Goal }>(`/members/${memberId}/goals`, send('POST', input), token)

// balance — сколько монет сейчас у ребёнка (хватает ли на цель)
export const getGoal = (token: string, id: string) => request<{ goal: Goal; balance: number }>(`/goals/${id}`, {}, token)

export const updateGoal = (token: string, id: string, input: GoalInput) => request<{ goal: Goal }>(`/goals/${id}`, send('PUT', input), token)

export const deleteGoal = (token: string, id: string) => request<void>(`/goals/${id}`, send('DELETE'), token)

// оплата монетами (только сам ребёнок); 409 not_enough_coins с полем missing, если не хватает
export const purchaseGoal = (token: string, id: string) => request<{ goal: Goal; balance: number }>(`/goals/${id}/purchase`, send('POST'), token)

export type * from './types'
