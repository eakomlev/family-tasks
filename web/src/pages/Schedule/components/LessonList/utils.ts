import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core'

// тексты для скринридеров по-русски (по умолчанию библиотека говорит по-английски)
export const instructions: ScreenReaderInstructions = {
  draggable:
    'Чтобы переставить урок, нажмите пробел, стрелками вверх и вниз выберите место и снова нажмите пробел. Escape отменяет перенос.',
}

export const announcements: Announcements = {
  onDragStart: () => 'Урок поднят.',
  onDragOver: ({ over }) => (over ? 'Урок над другим уроком.' : undefined),
  onDragEnd: () => 'Урок перемещён.',
  onDragCancel: () => 'Перенос отменён.',
}
