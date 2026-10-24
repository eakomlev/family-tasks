import { request, send } from '../client'
import type { ChessMove, Game, GameKind } from './types'

// Мои игры: приглашения, идущие партии и завершённые за последние сутки
export const listGames = (token: string) => request<{ games: Game[] }>('/games', {}, token)

export const getGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}`, {}, token)

// Пригласить участника семьи; 409 game_exists, если с ним уже идёт такая игра или ждёт ответа приглашение (в ответе она же)
export const inviteToGame = (token: string, kind: GameKind, opponentId: string) => request<{ game: Game }>('/games', send('POST', { kind, opponentId }), token)

export const acceptGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/accept`, send('POST'), token)

export const declineGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/decline`, send('POST'), token)

// Отозвать своё приглашение
export const cancelGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/cancel`, send('POST'), token)

// Ход в шахматах: клетки вроде «e2»; превращение пешки по умолчанию в ферзя
export const moveInGame = (token: string, id: string, move: Pick<ChessMove, 'from' | 'to'>) => request<{ game: Game }>(`/games/${id}/move`, send('POST', move), token)

export const resignGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/resign`, send('POST'), token)

export type * from './types'
