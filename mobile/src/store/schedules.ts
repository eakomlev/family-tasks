import { getSchedule, getTrainings, saveSchedule, saveTrainings, type Lesson, type Training } from '@/api'
import { api, fromApi } from './api'

export interface SaveSchedule {
  memberId: string
  lessons: Lesson[]
}

export interface SaveTrainings {
  memberId: string
  trainings: Training[]
}

// Расписания ребёнка: уроки и тренировки. Тег с id ребёнка: сохранение сбрасывает только его расписание,
// а событие сокета (тег без id) сразу все.
export const schedulesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSchedule: build.query<{ lessons: Lesson[] }, string>({
      queryFn: fromApi((token, memberId: string) => getSchedule(token, memberId)),
      providesTags: (_result, _error, memberId) => [{ type: 'Schedule', id: memberId }],
    }),
    getTrainings: build.query<{ trainings: Training[] }, string>({
      queryFn: fromApi((token, memberId: string) => getTrainings(token, memberId)),
      providesTags: (_result, _error, memberId) => [{ type: 'Trainings', id: memberId }],
    }),

    // Результат сохранения показывается сразу (то, что ушло на сервер), а не после повторного запроса; при ошибке откатывается.
    saveSchedule: build.mutation<void, SaveSchedule>({
      queryFn: fromApi((token, { memberId, lessons }: SaveSchedule) => saveSchedule(token, memberId, lessons)),
      async onQueryStarted({ memberId, lessons }, { dispatch, queryFulfilled }) {
        const patch = dispatch(schedulesApi.util.updateQueryData('getSchedule', memberId, (draft) => void (draft.lessons = lessons)))
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
      invalidatesTags: (_result, _error, { memberId }) => [{ type: 'Schedule', id: memberId }],
    }),
    saveTrainings: build.mutation<void, SaveTrainings>({
      queryFn: fromApi((token, { memberId, trainings }: SaveTrainings) => saveTrainings(token, memberId, trainings)),
      async onQueryStarted({ memberId, trainings }, { dispatch, queryFulfilled }) {
        const patch = dispatch(schedulesApi.util.updateQueryData('getTrainings', memberId, (draft) => void (draft.trainings = trainings)))
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
      invalidatesTags: (_result, _error, { memberId }) => [{ type: 'Trainings', id: memberId }],
    }),
  }),
})

export const { useGetScheduleQuery, useGetTrainingsQuery, useSaveScheduleMutation, useSaveTrainingsMutation } = schedulesApi
