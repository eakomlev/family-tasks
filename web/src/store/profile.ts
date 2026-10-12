import { setMood, updateProfile, type FamilyOverview, type ProfilePatch } from '@/api'
import type { ProfileData } from '@/profile/types'
import { api, fromApi } from './api'

// /api/me: текущий участник и состав семьи. Нужен почти всем экранам, поэтому первым переехал в кэш:
// после открытия приложения имена, фото и роли видны сразу из сохранённого, а свежие данные приходят следом.
// Применяет изменения к своей записи (и в «я», и в списке семьи): так экран обновляется до ответа сервера
function applyToMe(draft: ProfileData, patch: Partial<ProfileData['me']>) {
  Object.assign(draft.me, patch)
  const self = draft.members.find((m) => m.id === draft.me.id)
  if (self) Object.assign(self, patch)
}

export const profileApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<ProfileData, void>({
      query: () => ({ path: '/me' }),
      transformResponse: (res: FamilyOverview): ProfileData => ({ me: res.member, members: res.members }),
      providesTags: ['Me'],
    }),
    // Изменение профиля (имя, фото, дата рождения) и настроение: после них профиль запрашивается заново
    // Изменённое показывается сразу (в «я» и в списке семьи), при ошибке откатывается; затем профиль запрашивается заново
    updateProfile: build.mutation<unknown, ProfilePatch>({
      queryFn: fromApi((token, patch: ProfilePatch) => updateProfile(token, patch)),
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const result = dispatch(profileApi.util.updateQueryData('getMe', undefined, (draft) => applyToMe(draft, patch)))
        try {
          await queryFulfilled
        } catch {
          result.undo()
        }
      },
      invalidatesTags: ['Me'],
    }),
    setMood: build.mutation<unknown, number>({
      queryFn: fromApi((token, mood: number) => setMood(token, mood)),
      async onQueryStarted(mood, { dispatch, queryFulfilled }) {
        const at = new Date().toISOString()
        const result = dispatch(profileApi.util.updateQueryData('getMe', undefined, (draft) => applyToMe(draft, { mood: { value: mood, at } })))
        try {
          await queryFulfilled
        } catch {
          result.undo()
        }
      },
      invalidatesTags: ['Me'],
    }),
  }),
})

export const { useGetMeQuery, useUpdateProfileMutation, useSetMoodMutation } = profileApi
