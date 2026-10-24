// Доступные игры. Остальные (шашки, крестики-нолики, морской бой) пока заглушки.
export type GameKind = 'chess'

export type GameStatus = 'invited' | 'active' | 'finished' | 'declined' | 'cancelled'

export interface ChessMove {
  from: string
  to: string
  // ход в записи вида «Nf3»
  san: string
  promotion?: string
}

export interface GameResult {
  // null — ничья
  winnerId: string | null
  reason: 'checkmate' | 'stalemate' | 'draw' | 'resign'
}

export interface Game {
  id: string
  kind: GameKind
  status: GameStatus
  inviterId: string
  inviteeId: string
  // кто играет белыми (после принятия приглашения)
  whiteId: string | null
  // чей ход; null, пока игра не началась или уже закончилась
  turnId: string | null
  // позиция в нотации FEN
  fen: string
  moves: ChessMove[]
  lastMove: ChessMove | null
  result: GameResult | null
  createdAt: string
  updatedAt: string
}
