import { request, send } from '../client'
import type { EventInput, FamilyEvent } from './types'

// События, пересекающие период (не больше 100 дней), которые видит вошедший
export const listEvents = (token: string, from: string, to: string) =>
  request<{ events: FamilyEvent[] }>(`/events?from=${from}&to=${to}`, {}, token)

export const getEvent = (token: string, id: string) => request<{ event: FamilyEvent }>(`/events/${id}`, {}, token)

export const createEvent = (token: string, input: EventInput) => request<{ event: FamilyEvent }>('/events', send('POST', input), token)

export const updateEvent = (token: string, id: string, input: EventInput) =>
  request<{ event: FamilyEvent }>(`/events/${id}`, send('PUT', input), token)

export const deleteEvent = (token: string, id: string) => request<void>(`/events/${id}`, send('DELETE'), token)

export type * from './types'
