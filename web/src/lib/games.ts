import type { Game, GameResult, GameScore } from '@/api'

export interface GameInfo {
  // готовы шахматы, шашки и крестики-нолики, остальные пока заглушки
  kind: string
  title: string
  emoji: string
  available: boolean
}

export const GAMES: GameInfo[] = [
  { kind: 'chess', title: 'Шахматы', emoji: '♟️', available: true },
  { kind: 'checkers', title: 'Шашки', emoji: '⚪', available: true },
  { kind: 'tictactoe', title: 'Крестики-нолики', emoji: '❌', available: true },
  { kind: 'battleship', title: 'Морской бой', emoji: '🚢', available: false },
]

// Счёт с этим участником одной строкой; пока партий не было, строки нет
export function scoreLine(score: GameScore | undefined): string | null {
  if (!score || score.wins + score.losses + score.draws === 0) return null
  return `Побед: ${score.wins} · Поражений: ${score.losses} · Ничьих: ${score.draws}`
}

export const gameTitle = (kind: string) => GAMES.find((g) => g.kind === kind)?.title ?? 'Игра'

// Итог игры глазами участника viewerId
export function resultText(result: GameResult, viewerId: string): string {
  if (result.reason === 'resign') return result.winnerId === viewerId ? 'Соперник сдался. Вы победили!' : 'Вы сдались'
  if (result.reason === 'agreement') return 'Ничья по соглашению'
  if (result.reason === 'no_moves') return result.winnerId === viewerId ? 'У соперника не осталось ходов. Вы победили!' : 'У вас не осталось ходов. Вы проиграли'
  if (result.reason === 'line') return result.winnerId === viewerId ? 'Три в ряд. Вы победили!' : 'Соперник собрал три в ряд. Вы проиграли'
  if (!result.winnerId) return result.reason === 'stalemate' ? 'Пат. Ничья' : 'Ничья'
  return result.winnerId === viewerId ? 'Мат. Вы победили!' : 'Мат. Вы проиграли'
}

export const opponentOf = (game: Game, me: string) => (game.inviterId === me ? game.inviteeId : game.inviterId)

// Короткая строка состояния игры для списков («Ваш ход», «Ждём ответа»…)
export function gameStatusLine(game: Game, me: string): string {
  switch (game.status) {
    case 'invited':
      return game.inviteeId === me ? 'Приглашает вас сыграть' : 'Ждём ответа'
    case 'active':
      if (game.drawOffer) return game.drawOffer === me ? 'Вы предложили ничью' : 'Предлагает ничью'
      return game.turnId === me ? 'Ваш ход' : 'Ход соперника'
    case 'finished':
      return game.result ? resultText(game.result, me) : 'Игра окончена'
    case 'declined':
      return 'Приглашение отклонено'
    case 'cancelled':
      return 'Приглашение отозвано'
  }
}

// Нужно ли участнику что-то сделать в этой игре (ответить на приглашение или на предложение ничьей, или сходить)
export const needsMyAction = (game: Game, me: string) => game.turnId === me || (game.status === 'invited' && game.inviteeId === me) || (!!game.drawOffer && game.drawOffer !== me)

// Игры, которые ещё не закончились: приглашения и идущие партии; те, где ждут меня, выше
export function openGames(games: Game[], me: string): Game[] {
  return games
    .filter((g) => g.status === 'invited' || g.status === 'active')
    .sort((a, b) => Number(needsMyAction(b, me)) - Number(needsMyAction(a, me)))
}

// Последний ход словами: «Последний ход белых: Nf3» (нечётные ходы белых)
export function lastMoveText(game: Game): string | null {
  if (game.kind === 'tictactoe') return null
  if (game.kind === 'checkers') return game.lastPath ? `Последний ход: ${game.lastPath.join(' → ')}` : null
  if (!game.lastMove) return null
  return `Последний ход ${game.moves.length % 2 === 1 ? 'белых' : 'чёрных'}: ${game.lastMove.san}`
}

// Чем играет участник в крестики-нолики: первым ходит тот, кто в whiteId (крестики)
export const myMark = (game: Game, me: string) => (game.whiteId === me ? '✕' : '◯')
