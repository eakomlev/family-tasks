import type { Occurrence, Task } from '@/api'

export const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Задание',
  description: '',
  reward: 0,
  createdAt: '2026-10-11T10:00:00.000Z',
  authorId: 'm1',
  assigneeId: 'm1',
  date: null,
  time: null,
  repeat: { type: 'none', days: [], until: null },
  ...over,
})

export const occ = (taskId: string, date: string | null, done = false, pending = false): Occurrence => ({
  taskId,
  date,
  done: done ? { memberId: 'm1', at: '2026-10-11T10:00:00Z' } : null,
  pending: pending ? { memberId: 'm1', at: '2026-10-11T10:00:00Z' } : null,
})
