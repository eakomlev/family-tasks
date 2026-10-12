export interface Goal {
  id: string
  memberId: string
  title: string
  // цена в монетах
  price: number
  url: string | null
  // data URL (сжатая клиентом картинка) или null
  image: string | null
  createdAt: string
  // когда ребёнок оплатил цель; null — ещё не куплена
  purchasedAt: string | null
}

export interface GoalInput {
  title: string
  price: number
  url: string | null
  image: string | null
}
