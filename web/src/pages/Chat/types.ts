import type { ChatSummary, Member } from '@/api'
import type { Role } from '@/lib/roles'

export interface ChatRowProps {
  chat: ChatSummary
  // собеседник; undefined у общего чата
  member?: Member
  members: Member[]
  me: string
  // роль того, кто смотрит: ребёнок видит родителей как «Мама» и «Папа»
  viewerRole: Role
  now: Date
}
