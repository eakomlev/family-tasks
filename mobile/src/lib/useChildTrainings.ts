import { useEffect } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import type { Training } from '@/api'
import type { AppDispatch, RootState } from '@/store'
import { schedulesApi } from '@/store/schedules'

// Тренировки нескольких детей разом (число детей меняется, а хуки в цикле нельзя): каждому ребёнку подписка на его расписание в
// кэше, результат один объект «ребёнок → тренировки». undefined: ещё загружается.
export function useChildTrainings(childIds: string[]): Record<string, Training[] | undefined> {
  const dispatch = useDispatch<AppDispatch>()
  const key = childIds.join(',')

  useEffect(() => {
    const subscriptions = key.split(',').filter(Boolean).map((id) => dispatch(schedulesApi.endpoints.getTrainings.initiate(id)))
    return () => subscriptions.forEach((subscription) => subscription.unsubscribe())
  }, [dispatch, key])

  return useSelector(
    (state: RootState) =>
      Object.fromEntries(key.split(',').filter(Boolean).map((id) => [id, schedulesApi.endpoints.getTrainings.select(id)(state).data?.trainings])),
    shallowEqual,
  )
}
