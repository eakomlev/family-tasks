import type { Occurrence, Task, TaskList } from '@/api'

// вхождение вместе с заданием, к которому оно относится
export interface TaskEntry {
  task: Task
  occurrence: Occurrence
}

export const occurrenceKey = (taskId: string, date: string | null) => `${taskId}|${date ?? 'none'}`

// То же вхождение? (для обновления списка после отметки)
export const sameOccurrence = (o: Occurrence, taskId: string, date: string | null) => o.taskId === taskId && o.date === date

// Склеивает вхождения с заданиями; assigneeId — оставить только задания этого исполнителя.
export function toEntries(list: TaskList, assigneeId: string | null): TaskEntry[] {
  const tasks = new Map<string, Task>(list.tasks.map((t) => [t.id, t]))
  return list.occurrences
    .map((occurrence): TaskEntry | null => {
      const task = tasks.get(occurrence.taskId)
      return task && (assigneeId === null || task.assigneeId === assigneeId) ? { task, occurrence } : null
    })
    .filter((entry): entry is TaskEntry => entry !== null)
}

// Сначала с временем по возрастанию, потом без времени; внутри по названию.
export function byTimeThenTitle(a: TaskEntry, b: TaskEntry): number {
  if (a.task.time !== b.task.time) {
    if (!a.task.time) return 1
    if (!b.task.time) return -1
    return a.task.time < b.task.time ? -1 : 1
  }
  return a.task.title.localeCompare(b.task.title, 'ru')
}
