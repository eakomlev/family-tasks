import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconButton } from '@/components/IconButton'
import { Input } from '@/components/Input'
import { Card, Handle, Number, Room, Times } from './styles'
import type { LessonRowProps } from './types'

export function LessonRow({ index, lesson, onChange, onRemove }: LessonRowProps) {
  const label = `Урок ${index + 1}`
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.key })

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
      <Number aria-hidden>{index + 1}</Number>
      <Input
        value={lesson.subject}
        onChange={(e) => onChange({ subject: e.target.value })}
        maxLength={60}
        placeholder="Предмет"
        aria-label={`${label}: предмет`}
      />
      <IconButton type="button" aria-label={`${label}: удалить`} onClick={onRemove}>✕</IconButton>
      <Times>
        <Input
          type="time"
          value={lesson.startsAt}
          onChange={(e) => onChange({ startsAt: e.target.value })}
          aria-label={`${label}: начало`}
        />
        –
        <Input
          type="time"
          value={lesson.endsAt}
          onChange={(e) => onChange({ endsAt: e.target.value })}
          aria-label={`${label}: окончание`}
        />
        <Room
          value={lesson.room}
          onChange={(e) => onChange({ room: e.target.value })}
          maxLength={12}
          placeholder="Каб."
          aria-label={`${label}: кабинет`}
        />
      </Times>
    </Card>
  )
}
