import { request, send } from '../client'
import type { ProfilePatch, UpdateProfileResult } from './types'

export const updateProfile = (token: string, patch: ProfilePatch) =>
  request<UpdateProfileResult>('/me', send('PATCH', patch), token)

// Картинка аватара по нику Roblox (data URL); запрос делает сервер (у Roblox нет CORS). Только для детей.
export const getRobloxAvatar = (token: string, username: string) =>
  request<{ image: string }>('/me/roblox-avatar', send('POST', { username }), token)

export type * from './types'
