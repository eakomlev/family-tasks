// Событие семейного календаря. Видят автор и участники; allFamily: видят все в семье (тогда memberIds пусто).
export interface FamilyEvent {
  id: string
  title: string
  // YYYY-MM-DD
  startDate: string
  endDate: string
  // HH:MM; у события на весь день (или несколько дней) обе null
  startTime: string | null
  endTime: string | null
  allFamily: boolean
  memberIds: string[]
  authorId: string
  createdAt: string
}

// то, что отправляется при создании и изменении
export interface EventInput {
  title: string
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  allFamily: boolean
  memberIds: string[]
}
