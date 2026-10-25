// Доступные игры. Остальные (шашки, крестики-нолики, морской бой) пока заглушки.
export type GameKind = 'chess' | 'tictactoe'

export type GameStatus = 'invited' | 'active' | 'finished' | 'declined' | 'cancelled'

export interface ChessMove {
  from: string
  to: string
  // ход в записи вида «Nf3»
  san: string
  promotion?: string
}

// Во что превращается пешка, дошедшая до края доски
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

export interface GameResult {
  // null — ничья
  winnerId: string | null
  reason: 'checkmate' | 'stalemate' | 'draw' | 'resign' | 'line' | 'agreement'
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
  // крестики-нолики: поле из 9 знаков по строкам («X» ходит первым, он же whiteId, «O», «-» пусто), клетки по порядку ходов и последняя; у шахмат null и пусто
  board: string | null
  cells: number[]
  lastCell: number | null
  // кто предложил ничью и ждёт ответа соперника; null, если предложения нет (нет и у сервера прежней версии)
  drawOffer?: string | null
  result: GameResult | null
  createdAt: string
  updatedAt: string
}
