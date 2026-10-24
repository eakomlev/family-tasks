import type { TaskEntry } from '@/lib/occurrences'

export interface Section {
  key: string
  title: string
  items: TaskEntry[]
}
