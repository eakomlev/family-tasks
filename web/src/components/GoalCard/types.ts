import type { Goal } from '@/api'

export interface GoalImageProps {
  goal: Pick<Goal, 'image' | 'title' | 'purchasedAt'>
  // крупный вариант для страницы цели
  large?: boolean
}

export interface GoalCardProps {
  goal: Goal
  // сколько монет у ребёнка: показываем, сколько накоплено (у купленной и у родителей не нужно)
  balance?: number
}
