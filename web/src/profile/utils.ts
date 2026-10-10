import { ApiError, getMe } from '@/api'
import type { ProfileData } from './types'

export type ProfileResult =
  | { status: 'ok'; data: ProfileData }
  | { status: 'unauthorized' }
  | { status: 'failed' }

export async function fetchProfile(token: string): Promise<ProfileResult> {
  try {
    const res = await getMe(token)
    return { status: 'ok', data: { me: res.member, members: res.members } }
  } catch (err) {
    // токен больше не действителен (например, сессию отозвали)
    if (err instanceof ApiError && err.status === 401) return { status: 'unauthorized' }
    return { status: 'failed' }
  }
}
