import { createEvent, deleteEvent, getEvent, listEvents, updateEvent, type EventInput, type FamilyEvent } from '@/api'
import { api, fromApi } from './api'

export interface EventRange {
  from: string
  to: string
}

// События семейного календаря. Список периода и карточка в кэше; любое изменение (своё или чужое по сигналу `events`)
// сбрасывает тег, и открытые экраны запрашивают данные заново.
export const eventsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listEvents: build.query<{ events: FamilyEvent[] }, EventRange>({
      queryFn: fromApi((token, { from, to }: EventRange) => listEvents(token, from, to)),
      providesTags: ['Events'],
    }),
    getEvent: build.query<{ event: FamilyEvent }, string>({
      queryFn: fromApi((token, id: string) => getEvent(token, id)),
      providesTags: ['Events'],
    }),
    createEvent: build.mutation<{ event: FamilyEvent }, EventInput>({
      queryFn: fromApi((token, input: EventInput) => createEvent(token, input)),
      invalidatesTags: ['Events'],
    }),
    updateEvent: build.mutation<{ event: FamilyEvent }, { id: string; input: EventInput }>({
      queryFn: fromApi((token, { id, input }: { id: string; input: EventInput }) => updateEvent(token, id, input)),
      invalidatesTags: ['Events'],
    }),
    deleteEvent: build.mutation<void, string>({
      queryFn: fromApi((token, id: string) => deleteEvent(token, id)),
      invalidatesTags: ['Events'],
    }),
  }),
})

export const { useListEventsQuery, useGetEventQuery, useCreateEventMutation, useUpdateEventMutation, useDeleteEventMutation } = eventsApi
