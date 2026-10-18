import type { Member } from '../families/types'

// avatar: data URL — установить, null — удалить, отсутствует — не менять
export interface ProfilePatch {
  name?: string
  avatar?: string | null
  // YYYY-MM-DD, null — очистить
  birthDate?: string | null
}

export interface UpdateProfileResult {
  member: Member & { email: string }
}
