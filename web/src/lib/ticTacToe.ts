// Тройки клеток, выигрывающие в крестики-нолики (как на сервере)
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

// Выигравшая тройка клеток или null; поле это 9 знаков по строкам: «X», «O» или «-»
export function winningLine(board: string): number[] | null {
  return LINES.find(([a, b, c]) => board[a] !== '-' && board[a] === board[b] && board[a] === board[c]) ?? null
}
