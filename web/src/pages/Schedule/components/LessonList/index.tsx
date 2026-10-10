import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { LessonRow } from '../LessonRow'
import { List } from './styles'
import type { LessonListProps } from './types'
import { announcements, instructions } from './utils'

export function LessonList({ lessons, onChange, onRemove, onReorder }: LessonListProps) {
  const sensors = useSensors(
    // небольшой порог, чтобы простой тап по ручке не считался началом переноса
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = lessons.findIndex((l) => l.key === active.id)
    const to = lessons.findIndex((l) => l.key === over.id)
    if (from >= 0 && to >= 0) onReorder(arrayMove(lessons, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: instructions }}
    >
      <SortableContext items={lessons.map((l) => l.key)} strategy={verticalListSortingStrategy}>
        <List>
          {lessons.map((lesson, index) => (
            <LessonRow
              key={lesson.key}
              index={index}
              lesson={lesson}
              onChange={(patch) => onChange(lesson.key, patch)}
              onRemove={() => onRemove(lesson.key)}
            />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  )
}
