import type { ViewLesson } from '@/components/LessonViewList/types'

// «1 урок», «2 урока», «5 уроков»
export function pluralLessons(count: number): string {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} уроков`
  if (last === 1) return `${count} урок`
  if (last >= 2 && last <= 4) return `${count} урока`
  return `${count} уроков`
}

// «08:30–10:10» от начала первого до конца последнего урока, если время указано
export function dayRange(lessons: ViewLesson[]): string | undefined {
  const starts = lessons.map((l) => l.startsAt).filter((t): t is string => !!t)
  const ends = lessons.map((l) => l.endsAt).filter((t): t is string => !!t)
  if (starts.length === 0 || ends.length === 0) return undefined
  return `${starts.reduce((a, b) => (a < b ? a : b))}–${ends.reduce((a, b) => (a > b ? a : b))}`
}
