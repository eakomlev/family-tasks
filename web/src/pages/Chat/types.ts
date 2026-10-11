import type { ChatSummary, Member } from '@/api'

export interface ChatRowProps {
  chat: ChatSummary
  // собеседник; undefined у общего чата
  member?: Member
  members: Member[]
  me: string
  now: Date
}
