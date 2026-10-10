import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core'

// тексты для скринридеров по-русски (по умолчанию библиотека говорит по-английски)
export const instructions: ScreenReaderInstructions = {
  draggable:
    'Чтобы переставить элемент, нажмите пробел, стрелками вверх и вниз выберите место и снова нажмите пробел. Escape отменяет перенос.',
}

export const announcements: Announcements = {
  onDragStart: () => 'Элемент поднят.',
  onDragOver: ({ over }) => (over ? 'Элемент над другим элементом.' : undefined),
  onDragEnd: () => 'Элемент перемещён.',
  onDragCancel: () => 'Перенос отменён.',
}
