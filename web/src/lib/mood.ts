import { todayIso } from '@/lib/date'

export interface MoodChoice {
  value: number
  emoji: string
  label: string
}

// от радости (5) до грусти (1); в окне идут в таком же порядке слева направо
export const MOODS: MoodChoice[] = [
  { value: 5, emoji: '😄', label: 'Радость' },
  { value: 4, emoji: '🙂', label: 'Хорошо' },
  { value: 3, emoji: '😐', label: 'Нормально' },
  { value: 2, emoji: '😕', label: 'Не очень' },
  { value: 1, emoji: '😢', label: 'Грусть' },
]

// настроение ребёнка, как приходит с сервера (at: когда выбрано)
export interface MoodValue {
  value: number
  at: string
}

// Сегодняшнее настроение или undefined: выбранное в другой (местный) день считается сброшенным.
export function currentMood(mood: MoodValue | null | undefined, now: Date): MoodChoice | undefined {
  if (!mood || todayIso(new Date(mood.at)) !== todayIso(now)) return undefined
  return MOODS.find((m) => m.value === mood.value)
}
