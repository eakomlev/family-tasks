import type { CoinEntry } from '@/api'

export interface HistoryRowProps {
  entry: CoinEntry
  // подпись «когда · кто» (считает страница, она знает состав семьи)
  meta: string
}
