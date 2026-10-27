import { request, send } from '../client'
import type { ProfilePatch, UpdateProfileResult } from './types'

export const updateProfile = (token: string, patch: ProfilePatch) =>
  request<UpdateProfileResult>('/me', send('PATCH', patch), token)

// Настроение на сегодня, 1 (грусть) … 5 (радость); только ребёнок
export const setMood = (token: string, mood: number) => request<{ mood: { value: number; at: string } }>('/me/mood', send('PUT', { mood }), token)

// Картинка аватара по нику Roblox (data URL); запрос делает сервер (у Roblox нет CORS). Только для детей.
export const getRobloxAvatar = (token: string, username: string) =>
  request<{ image: string }>('/me/roblox-avatar', send('POST', { username }), token)

export type * from './types'

// Удаление своего аккаунта со всеми данными (нельзя ребёнку и создателю семьи)
export const deleteAccount = (token: string) => request<void>('/me', send('DELETE'), token)

// Телефон в профиле: код приходит SMS на новый номер, после подтверждения кодом номер сохраняется. Способ связи задаётся один раз: сменить и убрать его нельзя (409 contact_locked)
export const requestPhoneCode = (token: string, phone: string) => request<void>('/me/phone-code', send('POST', { phone }), token)
export const savePhone = (token: string, phone: string, code: string) => request<{ phone: string }>('/me/phone', send('PUT', { phone, code }), token)
// Email для участника, который зарегистрировался по телефону: код приходит письмом на новый адрес
export const requestProfileEmailCode = (token: string, email: string) => request<void>('/me/email-code', send('POST', { email }), token)
export const saveEmail = (token: string, email: string, code: string) => request<{ email: string }>('/me/email', send('PUT', { email, code }), token)

// Согласие на обработку персональных данных (экран согласия у прежних участников): сервер фиксирует текущую редакцию
export const acceptConsent = (token: string) => request<void>('/me/consent', send('POST'), token)
