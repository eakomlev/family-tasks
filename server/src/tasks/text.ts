import type { PushMessage } from '../notifications/messages.js'
import type { RepeatType } from './recurrence.js'

export interface TaskDto {
  id: string
  title: string
  authorId: string
  assigneeId: string
  // YYYY-MM-DD первого вхождения или null
  date: string | null
  // HH:MM или null
  time: string | null
  repeat: { type: RepeatType; days: number[]; until: string | null }
}

const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

// «12 октября»
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

// Когда и как часто: «12 октября в 18:00 · каждый день». Пусто, если срока нет.
export function dueText(task: Pick<TaskDto, 'date' | 'time' | 'repeat'>): string {
  const parts: string[] = []
  if (task.date) parts.push(task.time ? `${formatDate(task.date)} в ${task.time}` : formatDate(task.date))
  switch (task.repeat.type) {
    case 'daily':
      parts.push('каждый день')
      break
    case 'weekly':
      parts.push(`по ${task.repeat.days.map((d) => WEEKDAY_SHORT[d - 1]).join(', ')}`)
      break
    case 'monthly':
      parts.push('раз в месяц')
      break
  }
  return parts.join(' · ')
}

const withDue = (task: TaskDto) => [task.title, dueText(task)].filter(Boolean).join(' · ')

export const createdMessage = (task: TaskDto, authorName: string): PushMessage => ({
  title: 'Новое задание',
  body: `${authorName}: ${withDue(task)}`,
  url: `/tasks/${task.id}`,
  tag: `task:${task.id}`,
})

export const updatedMessage = (task: TaskDto, authorName: string): PushMessage => ({
  title: 'Задание изменено',
  body: `${authorName}: ${withDue(task)}`,
  url: `/tasks/${task.id}`,
  tag: `task:${task.id}`,
})

export const completedMessage = (task: TaskDto, doneByName: string): PushMessage => ({
  title: 'Задание выполнено',
  body: `${doneByName}: ${task.title}`,
  url: `/tasks/${task.id}`,
  tag: `task-done:${task.id}`,
})
