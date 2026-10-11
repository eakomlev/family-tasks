// «1 монета», «2 монеты», «5 монет»
export function coinsWord(n: number): string {
  const lastTwo = n % 100
  const last = n % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${n} монет`
  if (last === 1) return `${n} монета`
  if (last >= 2 && last <= 4) return `${n} монеты`
  return `${n} монет`
}

// Плашки награды в форме задания (0 — без награды); любое другое число вводится в поле «Другая».
export const REWARD_CHOICES = [0, 5, 10, 20, 50, 100]

export const MAX_REWARD = 1000
