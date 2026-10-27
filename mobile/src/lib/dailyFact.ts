import facts79 from '@/facts/facts-7-9.json'
import facts1013 from '@/facts/facts-10-13.json'
import { ageFromBirthDate, todayIso } from '@/lib/date'
import { getKv } from '@/lib/kv'

export interface Fact {
  id: number
  category: string
  emoji: string
  title: string
  text: string
}

// с этого часа факт дня появляется на «Моём дне»
export const FACT_START_HOUR = 9

// до 9 лет включительно (и если дата рождения не указана) берём факты 7–9, с 10 лет — 10–13
export function factsForAge(birthDate: string | null | undefined, now: Date): Fact[] {
  const age = birthDate ? ageFromBirthDate(birthDate, now) : null
  return age !== null && age >= 10 ? facts1013 : facts79
}

// номер дня в году, 1..366 (по местному времени; считаем в UTC, чтобы переход на летнее время не сдвигал день)
export function dayOfYear(now: Date): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const start = Date.UTC(now.getFullYear(), 0, 0)
  return Math.round((today - start) / 86_400_000)
}

// факт дня: в списке 366 фактов, поэтому за год (даже високосный) они не повторяются
export function factOfDay(facts: Fact[], now: Date): Fact {
  return facts[(dayOfYear(now) - 1) % facts.length]
}

export function shouldShowFact(now: Date): boolean {
  return now.getHours() >= FACT_START_HOUR
}

const storageKey = (memberId: string) => `fact-closed:${memberId}`

// закрыл ли ребёнок факт сегодня (хранится дата последнего закрытия на этом устройстве)
export function isFactClosed(memberId: string, now: Date): boolean {
  return getKv().getItem(storageKey(memberId)) === todayIso(now)
}

export function closeFact(memberId: string, now: Date): void {
  getKv().setItem(storageKey(memberId), todayIso(now))
}
