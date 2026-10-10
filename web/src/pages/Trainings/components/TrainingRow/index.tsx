import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconButton } from '@/components/IconButton'
import { Input } from '@/components/Input'
import { Card, Handle, Wide } from './styles'
import type { TrainingRowProps } from './types'

export function TrainingRow({ index, training, onChange, onRemove }: TrainingRowProps) {
  const label = `Тренировка ${index + 1}`
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: training.key })

  return (
    <Card
      ref={setNodeRef}
      $dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Handle
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`${label}: перетащить`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </Handle>
      <Input
        value={training.title}
        onChange={(e) => onChange({ title: e.target.value })}
        maxLength={60}
        placeholder="Название, например плавание"
        aria-label={`${label}: название`}
      />
      <IconButton type="button" aria-label={`${label}: удалить`} onClick={onRemove}>✕</IconButton>
      <Wide>
        <Input
          value={training.place}
          onChange={(e) => onChange({ place: e.target.value })}
          maxLength={60}
          placeholder="Где (необязательно)"
          aria-label={`${label}: место`}
        />
      </Wide>
      <Wide>
        <Input
          type="time"
          value={training.startsAt}
          onChange={(e) => onChange({ startsAt: e.target.value })}
          aria-label={`${label}: начало`}
        />
        –
        <Input
          type="time"
          value={training.endsAt}
          onChange={(e) => onChange({ endsAt: e.target.value })}
          aria-label={`${label}: окончание`}
        />
      </Wide>
    </Card>
  )
}
