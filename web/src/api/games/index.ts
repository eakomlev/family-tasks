import { request, send } from '../client'
import type { ChessMove, Game, GameKind, GameScore, PromotionPiece } from './types'

// Мои игры: приглашения, идущие партии и завершённые за последние сутки
export const listGames = (token: string) => request<{ games: Game[] }>('/games', {}, token)

export const getGameScore = (token: string, opponentId: string) => request<{ scores: GameScore[] }>(`/games/score?opponentId=${encodeURIComponent(opponentId)}`, {}, token)

export const getGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}`, {}, token)

// Пригласить участника семьи; 409 game_exists, если с ним уже идёт такая игра или ждёт ответа приглашение (в ответе она же)
export const inviteToGame = (token: string, kind: GameKind, opponentId: string) => request<{ game: Game }>('/games', send('POST', { kind, opponentId }), token)

export const acceptGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/accept`, send('POST'), token)

export const declineGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/decline`, send('POST'), token)

// Отозвать своё приглашение
export const cancelGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/cancel`, send('POST'), token)

// Ход в шахматах: клетки вроде «e2»; превращение пешки (promotion) по умолчанию в ферзя
export const moveInGame = (token: string, id: string, move: Pick<ChessMove, 'from' | 'to'> & { promotion?: PromotionPiece }) => request<{ game: Game }>(`/games/${id}/move`, send('POST', move), token)

// Ход в крестики-нолики: номер клетки 0–8 по строкам слева направо
export const placeInGame = (token: string, id: string, cell: number) => request<{ game: Game }>(`/games/${id}/place`, send('POST', { cell }), token)

// Ход в шашки: путь клеток из допустимых ходов игры (legal): откуда, потом куда, при ударе все остановки
export const playInGame = (token: string, id: string, path: string[]) => request<{ game: Game }>(`/games/${id}/play`, send('POST', { path }), token)

// Ничья по соглашению (шахматы): предложить, принять или отклонить предложение соперника
export const offerDraw = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/draw/offer`, send('POST'), token)

export const acceptDraw = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/draw/accept`, send('POST'), token)

export const declineDraw = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/draw/decline`, send('POST'), token)

export const resignGame = (token: string, id: string) => request<{ game: Game }>(`/games/${id}/resign`, send('POST'), token)

export type * from './types'
