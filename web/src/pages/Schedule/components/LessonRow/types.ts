import type { LessonDraft } from '../../types'

export interface LessonRowProps {
  index: number
  lesson: LessonDraft
  onChange: (patch: Partial<Omit<LessonDraft, 'key'>>) => void
  onRemove: () => void
}
