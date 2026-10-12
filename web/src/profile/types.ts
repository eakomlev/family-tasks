import type { Member } from '@/api'

export interface ProfileData {
  me: Member & { email: string; coins?: number }
  members: Member[]
}

export interface ProfileContextValue {
  // undefined, пока данные не загружены
  data?: ProfileData
  failed: boolean
}
