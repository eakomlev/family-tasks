import type { ReactNode } from 'react'

export interface SortableListProps<T extends { key: string }> {
  items: T[]
  // новый порядок целиком
  onReorder: (items: T[]) => void
  // строки списка: каждая сама вызывает useSortable({ id: item.key })
  children: ReactNode
}
