import type { TrainingDraft } from '../../types'

export interface TrainingRowProps {
  index: number
  training: TrainingDraft
  onChange: (patch: Partial<Omit<TrainingDraft, 'key'>>) => void
  onRemove: () => void
}
