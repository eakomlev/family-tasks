import type { Role } from '@/lib/roles'
import type { Link } from '../invites/types'

export interface Member {
  id: string
  name: string
  role: Role
  isOwner: boolean
  // data URL небольшого фото; приходит из /me, в ответах входа его нет
  avatar?: string | null
  // дата рождения YYYY-MM-DD (без времени); приходит из /me
  birthDate?: string | null
  // настроение ребёнка (1…5) и когда выбрано; у взрослых и без выбора null; приходит из /me
  mood?: { value: number; at: string } | null
}

// ответ любого запроса, после которого устройство получает новую сессию
export interface SessionResult {
  family: { code: string }
  member: Member & { token: string }
}

export interface SignupData {
  role: Role
  name: string
  email: string
  code: string
}

export interface CreateFamilyResult extends SessionResult {
  invite: Link
}

export interface FamilyOverview {
  // coins: баланс виртуальных монет, есть только у детей
  // isAdmin: администратор сервиса (раздел «Сервис» в профиле), приходит только про самого себя
  member: Member & { email: string; coins?: number; isAdmin?: boolean }
  family: { code: string }
  members: Member[]
}
