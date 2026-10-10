import type { TaskEntry } from '@/lib/occurrences'

export type Tab = 'upcoming' | 'done'

export interface Section {
  key: string
  title: string
  items: TaskEntry[]
}
