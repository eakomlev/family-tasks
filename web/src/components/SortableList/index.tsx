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
import { List } from './styles'
import type { SortableListProps } from './types'
import { announcements, instructions } from './utils'

// Список, строки которого переставляются перетаскиванием (мышь, касание, клавиатура).
export function SortableList<T extends { key: string }>({ items, onReorder, children }: SortableListProps<T>) {
  const sensors = useSensors(
    // небольшой порог, чтобы простой тап по ручке не считался началом переноса
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = items.findIndex((item) => item.key === active.id)
    const to = items.findIndex((item) => item.key === over.id)
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: instructions }}
    >
      <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
        <List>{children}</List>
      </SortableContext>
    </DndContext>
  )
}
