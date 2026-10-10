import type { LessonDraft } from '../../types'

export interface LessonListProps {
  lessons: LessonDraft[]
  onChange: (key: string, patch: Partial<Omit<LessonDraft, 'key'>>) => void
  onRemove: (key: string) => void
  // новый порядок целиком
  onReorder: (lessons: LessonDraft[]) => void
}
