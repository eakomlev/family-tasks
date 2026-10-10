import { request, send } from '../client'
import type { ProfilePatch, UpdateProfileResult } from './types'

export const updateProfile = (token: string, patch: ProfilePatch) =>
  request<UpdateProfileResult>('/me', send('PATCH', patch), token)

export type * from './types'
