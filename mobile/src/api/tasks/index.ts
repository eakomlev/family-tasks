import { request, send } from '../client'
import type { Occurrence, Task, TaskInput, TaskList } from './types'

// вхождения с from по to (YYYY-MM-DD), плюс просроченные и задания без срока.
// collapse: повторяющееся задание одним текущим вхождением (from считается сегодняшним днём), для списка «Предстоящие»
export const listTasks = (token: string, from: string, to: string, { collapse = false }: { collapse?: boolean } = {}) =>
  request<TaskList>(`/tasks?from=${from}&to=${to}${collapse ? '&collapse=true' : ''}`, {}, token)

// недавно выполненное, свежее сверху
export const listDoneTasks = (token: string, days = 30) =>
  request<TaskList>(`/tasks/done?days=${days}`, {}, token)

// Задание и одно его вхождение (date — день вхождения; без него первое или «без срока»).
// occurrence = null, если такого вхождения у задания нет.
export const getTask = (token: string, id: string, date?: string | null) =>
  request<{ task: Task; occurrence: Occurrence | null }>(
    `/tasks/${encodeURIComponent(id)}${date ? `?date=${date}` : ''}`,
    {},
    token,
  )

export const createTask = (token: string, input: TaskInput) =>
  request<{ task: Task }>('/tasks', send('POST', input), token)

export const updateTask = (token: string, id: string, input: TaskInput) =>
  request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}`, send('PUT', input), token)

export const deleteTask = (token: string, id: string) =>
  request<void>(`/tasks/${encodeURIComponent(id)}`, send('DELETE'), token)

// date — день вхождения (null для задания без срока)
export const completeTask = (token: string, id: string, date: string | null) =>
  request<void>(`/tasks/${encodeURIComponent(id)}/complete`, send('POST', { date }), token)

export const uncompleteTask = (token: string, id: string, date: string | null) =>
  request<void>(`/tasks/${encodeURIComponent(id)}/uncomplete`, send('POST', { date }), token)

// Подтвердить отправленное ребёнком на проверку (только родитель): выдаётся награда.
// Вернуть на доработку можно через uncompleteTask.
export const confirmTask = (token: string, id: string, date: string | null) =>
  request<void>(`/tasks/${encodeURIComponent(id)}/confirm`, send('POST', { date }), token)

// Ожидающие подтверждения: родитель видит все по семье, ребёнок свои
export const listPendingTasks = (token: string) => request<TaskList>('/tasks/pending', {}, token)

export type * from './types'
