import { createGoal, deleteGoal, getGoal, listGoals, purchaseGoal, updateGoal, type Goal, type GoalInput } from '@/api'
import { api, fromApi } from './api'

// Цели ребёнка. Список и карточка в кэше; покупка и правки сбрасывают теги целей и (при покупке) монеты.
export const goalsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listGoals: build.query<{ goals: Goal[] }, string>({
      queryFn: fromApi((token, memberId: string) => listGoals(token, memberId)),
      providesTags: ['Goals'],
    }),
    // balance — сколько монет у ребёнка: на карточке видно, хватает ли
    getGoal: build.query<{ goal: Goal; balance: number }, string>({
      queryFn: fromApi((token, id: string) => getGoal(token, id)),
      providesTags: ['Goals'],
    }),

    createGoal: build.mutation<{ goal: Goal }, { memberId: string; input: GoalInput }>({
      queryFn: fromApi((token, { memberId, input }: { memberId: string; input: GoalInput }) => createGoal(token, memberId, input)),
      invalidatesTags: ['Goals'],
    }),
    updateGoal: build.mutation<{ goal: Goal }, { id: string; input: GoalInput }>({
      queryFn: fromApi((token, { id, input }: { id: string; input: GoalInput }) => updateGoal(token, id, input)),
      invalidatesTags: ['Goals'],
    }),
    deleteGoal: build.mutation<void, string>({
      queryFn: fromApi((token, id: string) => deleteGoal(token, id)),
      invalidatesTags: ['Goals'],
    }),
    // Оплата: ответ сервера (цель куплена, новый баланс) сразу кладётся в кэш карточки, затем списки и монеты обновляются заново
    purchaseGoal: build.mutation<{ goal: Goal; balance: number }, string>({
      queryFn: fromApi((token, id: string) => purchaseGoal(token, id)),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(
            goalsApi.util.updateQueryData('getGoal', id, (draft) => {
              draft.goal = data.goal
              draft.balance = data.balance
            }),
          )
        } catch {
          /* ошибку показывает экран */
        }
      },
      invalidatesTags: ['Goals', 'Me', 'Coins', 'Earned'],
    }),
  }),
})

export const {
  useListGoalsQuery,
  useGetGoalQuery,
  useCreateGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
  usePurchaseGoalMutation,
} = goalsApi
