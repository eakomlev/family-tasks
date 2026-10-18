// Запись журнала монет: начисление (amount > 0) или списание (amount < 0)
export interface CoinEntry {
  id: string
  amount: number
  // за что: свободный текст, может быть пустым
  reason: string
  // ISO-время
  createdAt: string
  // кто сделал; null — система
  createdBy: string | null
}

export interface CoinHistoryPage {
  balance: number
  // свежие сверху
  items: CoinEntry[]
  // есть ли ещё более старые
  hasMore: boolean
}
