import type { Occurrence, Task } from '@/api'

export const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Задание',
  authorId: 'm1',
  assigneeId: 'm1',
  date: null,
  time: null,
  repeat: { type: 'none', days: [], until: null },
  ...over,
})

export const occ = (taskId: string, date: string | null, done = false): Occurrence => ({
  taskId,
  date,
  done: done ? { memberId: 'm1', at: '2026-10-11T10:00:00Z' } : null,
})
