import type { Goal, TaskList } from '@/api'
import { coinsWord } from '@/lib/coins'
import { toEntries } from '@/lib/occurrences'

export interface DayCount {
  // сделано: выполненные и отправленные на проверку (ребёнок своё сделал)
  done: number
  total: number
}

// Сколько моих заданий на сегодня (только с сегодняшней датой: без просроченных и «без срока») сделано.
export function countToday(list: TaskList, me: string, today: string): DayCount {
  const mine = toEntries(list, me).filter(({ occurrence }) => occurrence.date === today)
  const done = mine.filter(({ occurrence }) => occurrence.done !== null || occurrence.pending !== null).length
  return { done, total: mine.length }
}

// «1 задание», «2 задания», «5 заданий»
export function tasksWord(n: number): string {
  const lastTwo = n % 100
  const last = n % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${n} заданий`
  if (last === 1) return `${n} задание`
  if (last >= 2 && last <= 4) return `${n} задания`
  return `${n} заданий`
}

// крупная строка блока: сколько осталось до конца «уровня» дня
export function progressTitle({ done, total }: DayCount): string {
  if (total === 0) return 'На сегодня заданий нет'
  if (done >= total) return 'День пройден! Все задания сделаны'
  return `Ещё ${tasksWord(total - done)} — и день пройден!`
}

// ближайшая цель ребёнка: первая не купленная (сервер отдаёт их по дате создания)
export function currentGoal(goals: Goal[] | undefined): Goal | null {
  return goals?.find((goal) => goal.purchasedAt === null) ?? null
}

// путь к цели: доля накопленного (0…1) и подпись
export function goalProgress(goal: Goal, balance: number): { share: number; text: string } {
  const left = goal.price - balance
  return {
    share: Math.max(0, Math.min(1, balance / goal.price)),
    text: left > 0 ? `До цели «${goal.title}»: ${coinsWord(left)}` : `На цель «${goal.title}» монет хватает!`,
  }
}
