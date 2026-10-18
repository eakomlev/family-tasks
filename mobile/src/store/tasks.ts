import {
  completeTask,
  confirmTask,
  createTask,
  deleteTask,
  getTask,
  listDoneTasks,
  listPendingTasks,
  listTasks,
  uncompleteTask,
  updateTask,
  type Occurrence,
  type Task,
  type TaskInput,
  type TaskList,
} from '@/api'
import { api, fromApi } from './api'

export interface TaskRange {
  from: string
  to: string
  // повторяющееся задание одним текущим вхождением (список «Предстоящие»)
  collapse?: boolean
}

export interface OccurrenceRef {
  id: string
  // день вхождения, null для задания без срока
  date: string | null
}

// Изменение задания или отметки влияет на списки, ожидающие проверки, выполненные и (если есть награда) монеты ребёнка
const AFTER_TASK_CHANGE = ['Tasks', 'Pending', 'Done', 'Me', 'Coins', 'Earned'] as const

export const tasksApi = api.injectEndpoints({
  endpoints: (build) => ({
    listTasks: build.query<TaskList, TaskRange>({
      queryFn: fromApi((token, { from, to, collapse }: TaskRange) => listTasks(token, from, to, { collapse })),
      providesTags: ['Tasks'],
    }),
    listDoneTasks: build.query<TaskList, { days: number }>({
      queryFn: fromApi((token, { days }: { days: number }) => listDoneTasks(token, days)),
      providesTags: ['Done'],
    }),
    listPendingTasks: build.query<TaskList, void>({
      queryFn: fromApi((token) => listPendingTasks(token)),
      providesTags: ['Pending'],
    }),
    getTask: build.query<{ task: Task; occurrence: Occurrence | null }, { id: string; date?: string | null }>({
      queryFn: fromApi((token, { id, date }: { id: string; date?: string | null }) => getTask(token, id, date)),
      providesTags: ['Tasks'],
    }),

    createTask: build.mutation<{ task: Task }, TaskInput>({
      queryFn: fromApi((token, input: TaskInput) => createTask(token, input)),
      invalidatesTags: [...AFTER_TASK_CHANGE],
    }),
    updateTask: build.mutation<{ task: Task }, { id: string; input: TaskInput }>({
      queryFn: fromApi((token, { id, input }: { id: string; input: TaskInput }) => updateTask(token, id, input)),
      invalidatesTags: [...AFTER_TASK_CHANGE],
    }),
    deleteTask: build.mutation<void, string>({
      queryFn: fromApi((token, id: string) => deleteTask(token, id)),
      invalidatesTags: [...AFTER_TASK_CHANGE],
    }),
    completeTask: build.mutation<void, OccurrenceRef>({
      queryFn: fromApi((token, { id, date }: OccurrenceRef) => completeTask(token, id, date)),
      invalidatesTags: [...AFTER_TASK_CHANGE],
    }),
    uncompleteTask: build.mutation<void, OccurrenceRef>({
      queryFn: fromApi((token, { id, date }: OccurrenceRef) => uncompleteTask(token, id, date)),
      invalidatesTags: [...AFTER_TASK_CHANGE],
    }),
    confirmTask: build.mutation<void, OccurrenceRef>({
      queryFn: fromApi((token, { id, date }: OccurrenceRef) => confirmTask(token, id, date)),
      invalidatesTags: [...AFTER_TASK_CHANGE],
    }),
  }),
})

export const {
  useListTasksQuery,
  useListDoneTasksQuery,
  useListPendingTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useCompleteTaskMutation,
  useUncompleteTaskMutation,
  useConfirmTaskMutation,
} = tasksApi
