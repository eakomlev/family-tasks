import { createAction } from '@reduxjs/toolkit'
import { createApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react'
import { ApiError } from '@/api'
import { request, send } from '@/api/client'
import { retryRead } from '@/lib/retry'
import { getSession } from './session'

// Теги инвалидации: события сокета (store/invalidate.ts) и мутации сбрасывают нужные данные по ним
export const TAGS = ['Me', 'Tasks', 'Pending', 'Done', 'Schedule', 'Trainings', 'Goals', 'Coins', 'Earned', 'Chats', 'Messages'] as const
export type Tag = (typeof TAGS)[number]

export interface ApiRequest {
  path: string
  method?: string
  body?: unknown
}

// Ошибка в простом виде: в состоянии Redux хранится только сериализуемое
export interface ApiQueryError {
  status: number
  code: string
  body?: unknown
}

// Базовый запрос поверх общего `request`: те же заголовки, ошибки `ApiError` и повтор чтения на 429
export const apiBaseQuery: BaseQueryFn<ApiRequest, unknown, ApiQueryError> = async ({ path, method = 'GET', body }) => {
  const session = getSession()
  // вход ещё не прочитан или уже стёрт: запрос не отправляем и не выдаём это за 401 (иначе экран «выйдет» сам)
  if (!session) return { error: { status: 0, code: 'no_session' } }
  try {
    const data = await request<unknown>(path, send(method, body), session.token)
    return { data: data ?? null }
  } catch (err) {
    if (err instanceof ApiError) return { error: { status: err.status, code: err.code, body: err.body } }
    throw err
  }
}

// Запрос через готовую функцию клиента API (`@/api`) вместо описания пути: логика запросов остаётся в одном месте, тесты экранов
// по-прежнему подменяют функции `@/api`. Ошибка клиента превращается в простой объект (в Redux хранится только сериализуемое).
//
// Чтение (query) при пропаже связи не заканчивается ошибкой: оно повторяется каждые 2–3 секунды, пока экран открыт (отмена по signal),
// а экран всё это время показывает «Загрузка…» или прежние данные. Изменяющие запросы (mutation) не повторяются: решает человек.
export function fromApi<A, R>(call: (token: string, arg: A) => Promise<R>) {
  return async (arg: A, queryApi?: { type?: string; signal?: AbortSignal }): Promise<{ data: R } | { error: ApiQueryError }> => {
    const session = getSession()
    if (!session) return { error: { status: 0, code: 'no_session' } }
    try {
      const run = () => call(session.token, arg)
      return { data: (queryApi?.type === 'query' ? await retryRead(run, queryApi.signal) : await run()) as R }
    } catch (err) {
      if (err instanceof ApiError) return { error: { status: err.status, code: err.code, body: err.body } }
      throw err
    }
  }
}

// Обратно: ошибка запроса RTK Query (`.unwrap()`) снова становится `ApiError`, как её ждут экраны (`err.code`, `err instanceof ApiError`)
export function toApiError(error: unknown): never {
  if (error && typeof error === 'object' && 'status' in error && 'code' in error) {
    const e = error as ApiQueryError
    throw new ApiError(e.status, e.code, e.body)
  }
  throw error
}

// действие «кэш загружен из хранилища при старте»: RTK Query подхватывает его через extractRehydrationInfo
export const hydrateCache = createAction<unknown>('cache/hydrate')

export const api = createApi({
  reducerPath: 'api',
  baseQuery: apiBaseQuery,
  tagTypes: TAGS,
  // Показ из кэша и обновление: при открытии экрана данные старше 30 секунд запрашиваются заново, не пропадая с экрана
  // (в том числе только что загруженные из хранилища). Свежие данные повторно не запрашиваются: меньше запросов при переходах.
  refetchOnMountOrArgChange: 30,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  // кэш живёт неделю (как срок хранения в localStorage), а не минуту после ухода с экрана
  keepUnusedDataFor: 7 * 24 * 60 * 60,
  extractRehydrationInfo(action) {
    if (hydrateCache.match(action)) return action.payload as never
    return undefined
  },
  endpoints: () => ({}),
})
